---
title: "[V8] Chrome M152 ExternalString Race: EPT Entry Identity와 Native Resource Lifetime"
description: "Chrome M152 ExternalString double-fetch race에서 EPT entry identity와 native resource lifetime이 어긋나는 원인, UAF 증거와 exchange 패치를 분석한다."
date: "2026-10-01"
translation_key: "chrome-m152-externalstring-race"
tags: ["V8", "Chrome", "Sandbox", "Race condition"]
category: "V8"
concept_demo: "m152-lifetime"
private: false
published: true
---

이번에는 Chrome M152에서 분석했던 `ExternalString` double-fetch race를 정리해보겠다.

공개 범위에서는 빌드 전용 주소와 전체 PoC를 제외하고, 초기 취약점 분석, 실행 전제, 객체 수명 변화와 반복 실험을 안정화한 과정을 설명한다. 승인된 로컬 환경과 작성자가 관리한 별도 원격 검증 환경에서는 동일 계열의 후속 primitive를 거쳐 `/etc/hosts` 읽기까지 확인했다. 결과의 보안 경계는 1.2절과 11.1절에 고정해 설명한다. [5]

> **Research Question**
>
> M152 `ExternalString::DisposeResource`의 두 번 분리된 handle 해석은 native resource와 EPT entry의 대응을 깨뜨릴 수 있는가? 그렇다면 이를 어떻게 재현·판정할 수 있으며 upstream patch는 어떤 invariant를 복구하는가?

레이스가 한 번 관측되는 것과 브라우저에서 후속 동작까지 완료되는 것은 서로 다른 결과였다. 초기 d8 기록은 `11/150`의 UAF 관측을 남겼고, 이후 연구는 객체 소유권, allocator 재사용, 관측 개입을 차례로 대조하는 방향으로 이어졌다. 이 글은 공개 가능한 실행 결과와 실험 단위별 차이를 정리한다. [18]

이 글의 핵심 불변식은 하나다. **`Dispose()`할 native resource와 null로 교환한 EPT entry의 이전 payload가 같은 객체를 가리켜야 한다.** 본문은 이 불변식이 깨지는 과정과 복구되는 과정을 실험 기록에 연결하고, 부록 A는 교환 helper의 구현을 남긴다. [18]

## 핵심 요약

| 항목 | 이 글에서 주장하는 범위 |
|---|---|
| 대상 | Chrome `152.0.7977.64`, V8 `15.2.124.18`로 연결되는 고정 리비전 |
| 연구 시작점 | M152 정리 코드와 수정 패치를 대조해 `load()`/`store()` 사이의 대상 불일치를 분석 |
| 실행 모델 | race interleaving을 만들려면 `ExternalString.resource_` 핸들을 경쟁적으로 바꿀 수 있어야 함 |
| 루트 커즈 | `load()`가 선택한 리소스와 뒤의 `store()`가 비운 EPT 항목의 정체성이 달라질 수 있음 |
| 관측한 메모리 안전성 영향 | 해제된 out-of-cage 네이티브 `StringResource`를 남은 핸들로 다시 사용하는 UAF |
| 경계 해석 | V8 Sandbox 내부 손상이 같은 렌더러의 외부 네이티브 객체 수명에 영향을 주는 2차 primitive |
| 범위 밖 | 최초 메모리 손상 진입점, 일반적인 RCE, Chrome OS process sandbox escape, 새 OS 권한 획득 |
| 수정 | 선택한 EPT entry를 비우고 그 entry의 이전 payload를 반환하는 `exchange()`로 identity consistency를 회복 |

V8 Sandbox와 Chrome의 OS process sandbox는 서로 다른 방어 계층이며, 이 글의 분석 범위는 전자에 한정한다. [1, 2]

## 1. 초기 취약점 분석과 실행 전제

이 연구는 완성된 선행 primitive에 issue532를 붙이는 단계에서 시작한 것이 아니다. 먼저 M152의 `DisposeResource`와 수정 패치를 대조해 handle이 두 번 해석되는 정리 경로를 찾고, 가능한 interleaving과 최종 EPT 상태를 모델링했다. 그 뒤 회귀 테스트와 d8에서 UAF 가설을 검증하고, 브라우저의 소유권·allocator·소비 경로를 차례로 연결했다.

```text
대상·패치 고정
  → load/store 대상 불일치 분석
  → h1/h2 interleaving 모델
  → d8 UAF 재현과 판정
  → 브라우저 lifetime·reclaim 검증
  → 반복 race 축소와 controller 안정화
```

기록상 대상은 Chrome 152.0.7977.64 / V8 M152이며, 분석 대상은 ExternalString 외부 리소스의 정리와 수명 관리다. 대상 식별값과 실행 전제는 아래에, 자료별 확인 범위는 9.1절에 정리했다.

### 1.1 대상 빌드와 출처를 고정하기

후속 기술 개정 자료는 대상을 버전 이름뿐 아니라 소스 리비전과 바이너리 지문으로 식별한다. 여기서는 공개 저장소에서 확인한 관계와 연구 자료에 보고된 값을 나누어 기록했다. [15, 16]

Chromium 리비전 `506c834eccea`의 `chrome/VERSION`에서 Chrome `152.0.7977.64`를 확인했다. 같은 리비전의 DEPS에 지정된 `v8_revision`은 `6aacaf6256a0`이며, 해당 V8의 `include/v8-version.h`에는 `15.2.124.18`이 정의되어 있다. Upstream tag `15.2.124.18`도 같은 전체 커밋을 가리키며 2026년 8월 24일 기록이다. [15]

축약하지 않은 식별값은 다음과 같다. Chrome 바이너리의 SHA-256은 **연구 자료에 보고된 값**이다.

```text
Chromium revision: 506c834ecceaa943c5f41e6cfe7f68acb5c45346
V8 revision:       6aacaf6256a069ee455142333b7d38cad1c8d6e0
Chrome SHA-256:    3ed7df7904694145caf8da676d053f68300e8d2778a507e27b15f142c4efd0af
```

공개 소스로 확인한 연결은 `Chrome VERSION → Chromium DEPS → V8 VERSION`이며, 버전 표기의 정합성을 뒷받침한다. 바이너리·빌드 기록과의 대조 범위는 9.1절에 정리했다.

본문의 패치 함수는 수정 리비전 `7d1fb25`의 코드다. 대상 리비전은 조사한 버전을, 수정 리비전은 정리 경로의 변경을 식별한다.

### 1.2 실행 모델과 결과의 범위

연구의 시작점과 exploit chain의 진입 조건은 구분해야 한다. **초기 연구는 M152 정리 코드의 double-fetch와 패치 차이를 분석하는 데서 시작했다.** 다만 소스에서 도출한 interleaving을 실제 실행으로 만들려면 대상 `resource_` 핸들을 경쟁적으로 바꿀 수 있어야 한다. 공식 회귀 테스트는 `Sandbox.MemoryView`로 이 조건을 실험적으로 제공하고, 전체 체인은 별도의 in-cage primitive로 같은 필드 변경을 수행한다. [8]

따라서 cage 내부 쓰기는 이 취약점을 발견하기 전에 주어진 연구 출발점이 아니라, **issue532를 실행·체인화할 때 필요한 공격 모델**이다. 이 글은 초기 소스 분석부터 d8 재현, 브라우저 검증과 안정화까지 issue532 연구 전부를 다룬다. 반면 전체 체인에서 사용한 별도 in-cage primitive 자체의 원리와 개발 과정은 범위에서 제외한다.

V8의 메모리 경계는 샌드박스 내부 상태와 외부 메모리를 구분한다. Chrome 프로세스의 OS 경계는 접근 가능한 파일과 OS 자원을 제한한다. 이 두 경계의 역할을 나누어 3절의 수명 분석과 11절의 파일 읽기 결과를 읽는다. [1, 2]

보고된 **로컬 시험은 Linux x86-64에서 process sandbox가 비활성화된 문맥**이었다. 로컬 체크포인트의 높은 권한도 사전에 주어졌다. 따라서 파일 읽기는 주어진 OS 권한 안에서 후속 동작이 완료됐다는 검증이며, 새 OS 권한을 얻었다는 뜻은 아니다. 원격 검증 결과도 RCE나 OS sandbox escape의 증거로 사용하지 않는다. 파일 접근 결과의 의미는 11.1절에서 다룬다. [3, 5, 16]

## 2. ExternalString과 외부 리소스

문자열이라고 하면 JavaScript 힙 안에 문자 데이터까지 모두 들어 있다고 생각하기 쉽다. 하지만 `ExternalString`은 문자열 데이터를 외부 리소스와 연결해서 사용하는 표현이다. 따라서 문자열을 바라보는 V8 쪽 상태와 외부 리소스를 관리하는 네이티브 쪽 상태를 함께 생각해야 한다.

이때 문제가 되는 것은 문자열의 내용만이 아니다. 해당 리소스를 누가 소유하는지, 언제 정리할 수 있는지, 마지막 사용자가 사라졌는지까지 맞아야 한다. 포인터가 가리키는 위치가 그럴듯하더라도, 그 위치에 있어야 할 객체의 수명이 끝났다면 더 이상 정상적인 참조가 아니다.

V8 Sandbox는 내부 힙 손상이 같은 프로세스의 다른 메모리로 확장되는 것을 제한한다. 외부 리소스 참조에는 External Pointer Table, 즉 EPT를 통한 간접 참조가 사용된다. 내부 객체의 값이 곧바로 외부 네이티브 주소가 되는 것을 막기 위한 구조다. [1]

따라서 이번 분석에서는 두 가지를 나누어 봤다. 하나는 외부 리소스에 접근하는 **참조 경로의 정당성**이고, 다른 하나는 그 경로가 가리키는 **대상 객체의 생존 여부**다. 이 둘은 함께 맞아야 한다.

![V8 메모리 격리와 렌더러 프로세스의 OS 격리를 구분한 도식](/assets/research/chrome-m152-externalstring-race/01-boundaries.svg)

*그림 1. 같은 렌더러 프로세스 안의 메모리 경계와 OS 자원 접근 경계는 별개다. 이 그림은 보호 범위를 설명하며, 실제 주소 배치나 우회 경로는 나타내지 않는다.*

### 2.1 공개 API에서 확인할 수 있는 수명 계약

구조를 이해하기 위해 공개 헤더의 `ExternalStringResourceBase`와 `ExternalStringResource`를 먼저 보겠다. `data()`는 문자 버퍼, `length()`는 그 버퍼의 길이를 다룬다. 리소스의 기본 정리 구현에는 다음 코드가 있다. 서로 다른 클래스의 역할을 함께 설명하는 발췌다. [6]

```cpp
virtual void Dispose() { delete this; }
```

이 한 줄의 의도는 리소스가 더 이상 필요 없을 때 소유자가 정리를 수행하도록 하는 것이다. 하위 클래스는 정리 방법을 바꿀 수 있다. 문자 데이터의 불변성과 리소스 객체의 생존은 서로 다른 조건이다. 같은 문자열 내용을 계속 볼 수 있어도, 그 내용을 제공하던 리소스 객체의 수명이 끝났다면 그 객체를 다시 호출할 수는 없다. [6]

### 2.2 문자열 객체와 리소스 객체를 나누어 보기

이 글에서는 관계를 설명하기 위해 다음 기호를 사용하겠다. 실제 필드 이름이나 바이트 단위 레이아웃을 나타낸 것은 아니다.

이 글에서 **H**는 V8 힙에 있는 문자열 객체, **h**는 외부 대상을 표현하는 핸들, **E**는 외부 포인터 테이블의 항목을 뜻한다. H의 생존은 엔진이 추적하며, h와 E는 어느 대상을 참조하고 그 참조가 유효한 대상으로 연결되는지 검토하는 요소다.

**R**은 네이티브 리소스 객체이고, **B**는 그 리소스가 제공하는 문자 버퍼다. R의 소유권과 수명이 유지되는지, B에 대한 데이터 접근이 유효한지는 별도로 확인한다.

`H`가 관측된다고 `R`의 수명이 자동으로 증명되는 것은 아니다. `B`의 내용이 남아 있다고 해서 `R`도 살아 있다고 볼 수 없다. 각각 다른 상태를 보고 있기 때문이다. 외부 객체를 분석할 때 이 구분을 하지 않으면 문자 데이터가 정상으로 보인다는 이유로 리소스의 UAF를 놓칠 수 있다.

![문자열 객체, 외부 참조, EPT, 네이티브 리소스, 문자 버퍼의 개념적 관계](/assets/research/chrome-m152-externalstring-race/06-external-reference.svg)

*그림 2. H, h, E, R, B의 관계를 표현한 구조도다. 테이블 항목과 리소스의 수명 일관성이 유지되어야 한다. 목표 빌드의 메모리 배치를 복제한 그림은 아니다.*

## 3. 레이스에서 살펴본 수명 불일치

분석의 출발점은 외부 리소스를 정리하는 `ExternalString::DisposeResource` 경로였다. 분석에서는 이 경로의 double-fetch를 핵심 원인으로 다룬다. [3] 공개 수정 커밋도 이슈 `532204454`를 명시하며, 리소스 정리 중 EPT 항목의 일관성이 깨지는 문제를 설명한다. [8]

Double-fetch는 같은 공유 상태를 서로 다른 시점에 다시 읽는 패턴을 뜻한다. 두 번 읽는 행위 자체가 항상 잘못된 것은 아니다. 다만 두 읽기 사이에 상태가 바뀔 수 있다면, 앞에서 확인한 대상과 뒤에서 처리하는 대상이 같다는 가정을 계속 사용할 수 있는지 확인해야 한다.

리소스를 정리하는 작업에는 적어도 두 가지 의미가 있다. 실제 객체의 수명을 끝내는 것과, 그 객체로 이어지는 참조를 더 이상 유효하게 취급하지 않도록 하는 것이다. 이 처리가 서로 어긋나면 객체는 사라졌는데 접근 경로는 남는 상태가 생길 수 있다.

이번에 주목한 부분도 이 불일치였다. 문제의 중심은 외부 주소의 숫자 모양보다 **정리한 대상과 정리했다고 간주한 참조가 같은 대상을 뜻하는가**에 있었다.

남은 참조를 나중에 사용하면 use-after-free, 즉 UAF로 이어질 수 있다. 참조의 잔존, 실제 사용, 외부 메모리 영향에 대응하는 관측 기준은 9.1절에 정리했다.

![정상 종료와 수명 불일치에서 객체 상태와 참조 상태가 달라지는 모습](/assets/research/chrome-m152-externalstring-race/02-lifetime.svg)

*그림 3. 정상 종료에서는 객체 수명과 참조의 유효성이 함께 정리된다. 수명 불일치에서는 이미 종료된 객체를 향한 접근 경로가 남을 수 있다.*

### 3.1 안전한 사용 조건을 식으로 정리하기

앞의 설명을 분석용 조건으로 표현하면 다음과 같다. 아래는 실제 V8 코드가 아니라, 어떤 상태가 동시에 성립해야 하는지 정리한 논리식이다.

```text
SafeUse(h, R, t) =
    ResolvesTo(h, R, t)
    AND ExpectedKind(R)
    AND Alive(R, t)
    AND HeldForThisUse(R, t)
```

참조가 `R`로 해석되는 것, 기대하는 종류의 대상인 것, 실제로 살아 있는 것, 이번 사용이 끝날 때까지 소유권이 유지되는 것을 구분했다. 앞의 일부 조건만 맞으면 나머지도 맞을 것이라고 가정할 수는 없다.

특히 사용 시작 시점의 확인만으로 충분하지 않다. 안전한 소유권 모델에서는 **사용 구간 전체가 리소스의 생존 구간 안에 포함**되어야 한다. 이 관계가 깨지면 주소가 유효하게 해석되는 동안에도 시간적 메모리 안전성은 무너질 수 있다.

### 3.2 개별 읽기의 원자성과 작업 전체의 일관성

공유 상태를 읽는 연산 하나의 원자성과 정리 작업 전체의 대상 일치는 다른 보장이다. 원자적 읽기는 부분적으로 섞인 값을 막지만, 뒤의 작업도 같은 대상을 처리한다는 계약까지 만들지는 않는다.

이 경로에서 개발자가 의도한 결과는 **실제 정리한 리소스와 정리한 참조의 이전 대상이 일치하는 것**이다. 이전 경로의 결함은 참조를 해석하는 작업들이 이 대상 일치를 하나의 계약으로 유지하지 못할 수 있었다는 점이다. 객체 정리와 참조 정리가 서로 다른 대상을 처리하면, 종료된 객체로 이어지는 경로가 유효하게 남는 시간적 안전성 문제가 된다. [8, 18]

수정 코드는 선택한 항목을 교환한 결과를 지역 값으로 보관해 정리한다. 3.3절 수정 함수의 `value`와 부록 A의 반환 경로를 연결해 읽으면, 패치가 바꾼 핵심은 읽기 횟수보다 **대상 선택과 정리 사이의 데이터 의존성**이라는 점이 드러난다. null 검사와 메모리 집계 분기는 그 이후의 콜백 처리를 정한다.

#### 3.2.1 수정 전 코드와 `h1/h2` interleaving

다음은 대상 M152 리비전에서 문제가 된 의미만 남긴 축약 코드다. 실제 분기와 타입 정의는 더 많지만, 원인을 설명하는 핵심은 첫 `load()`와 마지막 `store()`가 `resource_`를 서로 다른 시점에 해석한다는 점이다.

```cpp
// Vulnerable shape — target M152 revision, simplified
Address value = resource_.load(isolate);
auto* resource =
    reinterpret_cast<ExternalStringResourceBase*>(value);

if (resource != nullptr) {
  resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
  resource->Dispose();
  resource_.store(isolate, kNullAddress);
}
```

유효한 두 핸들을 `h1`, `h2`라고 하자. 실행 모델의 in-sandbox field write가 첫 읽기와 마지막 저장 사이에 힙 필드를 `h2`에서 `h1`으로 바꾸면, 정리 콜백은 첫 읽기가 선택한 `R2`에 실행되지만 마지막 저장은 그 시점의 `h1`을 다시 읽어 다른 EPT 항목을 비울 수 있다.

```text
정리 실행 흐름                              공격자 Worker
────────────────────────────────────────────────────────
resource_에서 h2를 읽고 R2를 선택
R2의 Unaccount()/Dispose()
                                             resource_ = h1
resource_.store(null)가 현재 h1을 다시 읽음
EPT[h1]은 비워지고 EPT[h2]는 해제된 R2를 유지
```

| 시점 | `resource_` | `EPT[h1]` | `EPT[h2]` | 결과 |
|---|---|---|---|---|
| 시작 | `h2` | live R1 | live R2 | 두 리소스 모두 생존 |
| 첫 읽기 후 | `h2` | live R1 | live R2 | 지역 변수는 R2 |
| `Dispose(R2)` 후 | `h2` | live R1 | R2의 이전 주소 | R2 수명 종료 |
| 필드 교체 후 | `h1` | live R1 | R2의 이전 주소 | `h2` 쪽 참조가 잔존 |
| 마지막 저장 후 | `h1` | `null` | **R2의 이전 주소** | `h2`가 dangling 상태 |

따라서 취약성은 “두 번 읽었다”는 문법 자체보다 **정리한 리소스와 무효화한 EPT 항목의 정체성이 달라질 수 있다**는 데 있다. 연구 대상 빌드에서 해제된 리소스는 48바이트 크기 클래스에 있었고, 후속 실험은 같은 주소가 동형 할당으로 재사용되는지를 별도 판정으로 측정했다. 이 크기는 빌드 전용 관측값이며 다른 버전에 그대로 적용할 수 없다.

수정된 형태는 `exchange()`가 선택한 항목을 비우면서 그 항목의 이전 주소를 반환하고, 바로 그 반환값만 정리 대상으로 사용한다.

```cpp
Address value = resource_.exchange(isolate, kNullAddress);
auto* resource =
    reinterpret_cast<ExternalStringResourceBase*>(value);

if (resource != nullptr) {
  resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
  resource->Dispose();
}
```

아래의 실제 수정 함수와 부록 A의 교환 helper를 함께 보면, 축약 코드에서 생략한 shared-space 분기와 GC mark 보존까지 확인할 수 있다.

#### 3.2.2 재현 모델과 `11/150`의 UAF 판정 기준

공식 회귀 테스트는 소스 분석에서 도출한 interleaving을 실행으로 검증하는 최소 harness다. `--sandbox-testing --use-external-strings`에서 두 `ExternalString`을 만들고, `Sandbox.MemoryView`로 `content1.resource_`에 `content2`의 핸들을 먼저 쓴다. 이후 Worker가 같은 필드에 원래 `content1` 핸들을 반복해서 쓰는 동안 `content1`의 정리 경로를 실행하고, 마지막에 `content2`를 소비한다. 즉 정상 API가 리소스 소유권을 바꾸는 시험이 아니라, **harness가 제공한 cage 내부 쓰기로 handle-field race를 재현하는 시험**이다. 실제 체인에서는 별도 in-cage primitive가 이 역할을 맡는다. [8]

초기 d8의 `11/150`에서 UAF로 센 조건은 다음과 같다.

1. 첫 정리에서 `h2`가 선택되어 `R2`가 해제되고, 마지막 clear는 바뀐 `h1`에 적용되어 `EPT[h2]`가 남는다.
2. 이후 `content2` 소비 또는 teardown의 정리 경로가 남은 `h2`를 통해 같은 해제 객체를 다시 사용한다.
3. ASan이 `ExternalString::DisposeResource`의 후속 접근을 `heap-use-after-free`로 보고하고, allocation·free·use stack과 동일 해제 주소를 연결한다.
4. 그 주소가 기록된 V8 cage 상한보다 높은 네이티브 힙 주소임을 확인한다.

따라서 단순 크래시, 핸들 값 변화, 해제 뒤 남은 주소, 또는 주소 재사용 하나만으로는 이 `11/150`의 UAF 성공으로 세지 않았다. release 빌드에서 같은 48바이트 슬롯을 제어 데이터로 되채웠을 때만 나타난 `4/40`의 controlled-address fault와 no-reclaim `0/40`은 별도의 A/B 근거이며, ASan 집계의 판정 기준과 섞지 않았다. [3, 18]

### 3.3 실제 정리 함수 전체를 읽기

아래는 수정 리비전 `7d1fb25`의 [`src/objects/string-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/objects/string-inl.h#L1525)에 있는 `DisposeResource` 함수 전체다. 조건 분기, 메모리 집계 콜백, 정리 호출과 GC 관련 스코프를 모두 포함했다. [9]

```cpp
void ExternalString::DisposeResource(Isolate* isolate) {
  DisallowGarbageCollection no_gc;

  Address value = resource_.exchange(isolate, kNullAddress);
  v8::String::ExternalStringResourceBase* resource =
      reinterpret_cast<v8::String::ExternalStringResourceBase*>(value);

  // Dispose of the C++ object if it has not already been disposed.
  if (resource != nullptr) {
    if (!IsShared() && !HeapLayout::InWritableSharedSpace(this)) {
      resource->Unaccount(reinterpret_cast<v8::Isolate*>(isolate));
    }
    DisableGCMole no_gc_mole;
    resource->Dispose();
  }
}
```

![수정된 DisposeResource의 null·집계·정리 분기](/assets/research/chrome-m152-externalstring-race/07-dispose-flow.ko.svg)

*코드 흐름 A. 수정 리비전의 정리 경로다. null 결과는 콜백을 건너뛰고, shared-state 분기는 집계 콜백의 호출 여부를 정한다.*

[확대해서 보기](/assets/research/chrome-m152-externalstring-race/07-dispose-flow.ko.svg)


`DisallowGarbageCollection`은 GC가 일어나지 않아야 하는 구간을 표시하는 디버그 assertion 스코프다. 공유 참조를 동기화하는 잠금은 아니다. 뒤의 `DisableGCMole` 역시 raw 리소스 작업 구간의 GCMole 검증을 건너뛰는 디버그 스코프이며, 공유 참조의 잠금으로 해석할 수 없다. [11]

`resource_.exchange`는 선택한 EPT 항목의 이전 값을 얻으면서 그 항목의 포인터 값을 비운다. [10] `reinterpret_cast`는 이 주소를 리소스 포인터 타입으로 표현하지만 객체의 생존을 검사하지 않는다. null 검사는 리소스가 없을 때 호출을 생략할 뿐, non-null인 대상이 살아 있다는 뜻은 아니다.

`Unaccount`는 외부 메모리 집계용 콜백이다. 기본 구현은 비어 있고 구체 처리는 하위 클래스에 달려 있어 객체 정리와 역할이 다르다. [12] 실제 정리 구현은 `Dispose()`가 호출하며, 기본 구현과 하위 클래스의 계약은 2.1절에서 설명했다.

`value`는 교환 전의 값을 담고, 그 값으로 표현한 리소스가 null이 아닐 때만 정리 블록에 들어간다. `Unaccount`는 두 shared-space 관련 조건이 모두 해당하지 않는 경로에서만 호출된다. 이어지는 `Dispose` 호출의 수명 계약과 EPT의 교환 구현을 함께 봐야 전체 의미를 읽을 수 있다.

이 함수의 의도는 **같은 외부 리소스에 대한 참조 정리와 객체 정리를 일관되게 수행하는 것**이다. 캐스팅이나 null 검사가 있다고 해서 그 수명 계약이 자동으로 성립하는 것은 아니다.

### 3.4 코드에서 확인한 사실과 원인 해석

공개 패치와 관측을 연결할 때 먼저 고정한 것은 **정리한 리소스와 포인터 값을 비운 EPT 항목의 이전 대상이 같아야 한다**는 불변식이다. `R`의 수명이 끝났다면 그 정리 작업에서 갱신한 `E`도 바로 그 `R`을 참조하던 항목이어야 한다. 참조 처리와 객체 정리가 서로 다른 대상을 다루면, 객체가 종료된 뒤에도 유효하게 취급되는 접근 경로가 남을 수 있다. [8]

**원인 쪽의 계약 실패**는 분리된 참조 처리가 이 대상 일치를 유지하지 못할 수 있었다는 점이다. 개별 읽기가 원자적이어도 작업의 앞뒤가 같은 대상을 처리한다는 보장은 따로 필요하다. 메모리 순서를 강하게 지정하는 것만으로 그 대상의 동일성이 만들어지지는 않는다. 이 때문에 결함을 캐스팅 문법, null 검사의 유무나 `Unaccount` 콜백의 존재로 설명하지 않았다.

**패치 쪽의 대응**은 선택한 항목의 교환 결과를 정리 대상으로 사용하는 것이다. 수정된 sandbox 경로는 핸들로 항목을 선택하고, 그 항목의 payload를 교환한다. 성공한 CAS에서는 새 payload로의 교체와 교체 직전 payload의 확정이 **한 원자적 연산에 묶인다**. 이전 값을 따로 확정한 뒤 별도의 단계에서 새 값을 쓰는 것으로 읽으면 이 관계를 놓친다. [10]

entry 함수가 반환한 이전 주소는 위임 계층을 거쳐 `DisposeResource`의 지역 변수 `value`가 된다. 캐스팅과 콜백은 그 지역 값으로 표현한 리소스를 사용한다. 따라서 코드 흐름 A–C를 함께 읽으면 **선택한 항목의 교환 결과가 같은 리소스의 정리로 이어진다**는 대응을 확인할 수 있다. 여기서 힙 멤버의 핸들, EPT 슬롯의 존재, payload의 포인터 값은 서로 다른 상태이며, sandbox 교환 경로가 바꾸는 것은 선택한 payload다. [9, 10]

**실행에서 대조할 질문**은 어느 객체의 수명이 끝났고, 그 객체를 유효하게 취급하는 참조가 사용됐는가다. 이 질문을 따라 5절에서 연구 진행을, 11절에서 최종 결과를 설명한다. 소스와 실행 기록의 확인 범위는 9.1절에 모았다.

### 3.5 정리 함수의 입력·분기·결과

최상위 함수는 `void`를 반환한다. 내부의 교환 연산이 이전 주소를 반환하는 것과, `DisposeResource` 자체가 리소스 주소를 호출자에게 돌려주는 것은 다른 이야기다. 이 함수는 자신의 멤버와 `isolate` 문맥을 사용해 정리를 수행한다. [9]

교환 결과가 null이면 처리할 이전 리소스 주소가 없으므로 리소스 콜백 블록을 건너뛴다. 이전 리소스가 있고 두 shared-state 조건이 모두 false이면 `Unaccount` 이후 `Dispose`를 호출한다. 이때 집계 콜백과 실제 정리 콜백의 역할은 구분해야 한다.

shared-state 조건 중 하나라도 true이면 `Unaccount`만 건너뛰고 `Dispose`는 호출한다. 이 분기가 리소스 정리 자체를 생략하는 것은 아니다.

교환 이후 `value`는 지역 변수에 보관된다. 캐스팅은 이 값을 콜백 호출에 사용할 포인터 타입으로 표현하며, 별도의 객체 생성이나 생존 판정을 수행하지 않는다. 또한 `Unaccount`는 가상 콜백이므로 기본 구현이 비어 있다는 사실과 실제 하위 클래스의 동작은 구분해서 읽어야 한다. [9, 12]

이 코드의 핵심은 테이블의 참조 상태를 바꾸는 연산과 리소스 객체의 정리 콜백을 함께 보는 것이다. 전자는 EPT 상태의 변화이고, 후자는 리소스 계약의 수행이다. 어느 한쪽의 코드만 보고 전체 수명 처리가 끝났다고 판단하기 어렵다.

### 3.6 대상 선택의 일관성과 사용 중 수명은 별개의 계약이다

패치가 직접 해결하는 것은 선택한 EPT 항목과 정리할 리소스의 일치다. 선택한 항목의 교환 결과를 지역 변수로 받아 그 값만 `Dispose()`에 전달한다. 이미 리소스를 사용 중인 다른 경로의 수명은 별도의 소유권 계약이다. [8–10]

```text
exchange()            → 선택한 entry와 반환한 resource의 identity consistency
reference ownership   → 이미 사용 중인 resource의 전체 lifetime 보장
```

`exchange()`는 다른 사용자의 종료를 기다리거나 소유권을 획득하지 않는다. CAS 성공도 한 payload의 교환을 확정할 뿐, 뒤의 가상 콜백까지 원자적으로 만들지 않는다. 따라서 이후 절에서는 패치가 복구한 **cleanup-target identity**를 기준 모델로 삼고, 객체 소유권·데이터 캐시·CFI는 실행 결과를 판정하는 별도 조건으로만 다룬다. 부록 A의 helper들도 이 한 정리 경로를 구현하는 계층이지 별도 취약점이 아니다. [9, 10, 17]

## 4. 우회가 겨냥한 보호 가정

EPT는 sandbox 내부 handle을 외부 포인터로 바로 사용하지 못하게 막는 indirection이지만, 타입 검사만 하는 장치는 아니다. 공식 소스는 유효한 entry를 살아 있는 객체와 연결해 시간적 안전성을 유지한다는 설계 의도를 설명한다. `Verify()`와 `ManagedResource`의 주석도 테이블 상태와 외부 리소스 수명의 일관성을 강조한다. [7]

이번 연구의 질문은 **그 일관성을 유지해야 하는 정리 경로에서, 선택한 entry와 실제로 정리한 resource가 갈라질 수 있는가**였다. `h2`로 `R2`를 얻은 뒤 `h1`을 비우면 indirection과 태그 검사를 거쳤더라도 `EPT[h2] → freed R2`가 남는다.

따라서 방어 검토의 기준도 간단하다. 참조가 허용된 형식인가에 더해, 정리 전후에 같은 entry와 같은 resource의 대응관계가 유지되는지를 확인해야 한다.

### 4.1 공간적 안전성과 시간적 안전성

타입 일관성은 기대한 종류의 대상을 사용하는지 확인하고 참조의 해석 범위를 제한한다. 공간적 안전성은 허용된 객체의 범위 안에 접근하는지, 즉 접근 위치와 범위를 다룬다.

시간적 안전성은 사용 시점에도 객체가 살아 있는지 확인하는 해제·사용의 관계다. 정체성 일관성은 여러 단계의 작업에서 처음 확인한 바로 그 객체를 끝까지 처리하는지에 관한 조건이다.

이번 분석의 중심은 이 가운데 외부 객체의 시간적 안전성과 정체성 일관성이다.

## 5. 연구는 어떤 질문을 따라 진행했는가

연구에서는 **그 관측이 어떤 판단을 허용했고, 다음에 무엇을 확인해야 했는가**를 따라갔다. 아래는 소스, d8 시험, 브라우저 진행 기록과 완료 요약에 남은 검토 질문을 연결한 것이다. 자료별 출처는 9.1절에 정리했다. [3, 16]

![원인, 실행 관측, 브라우저 환경, 결과 해석이라는 연구 질문의 관계](/assets/research/chrome-m152-externalstring-race/04-research.svg)

*그림 4. 연구에서 다룬 질문을 묶은 도식이다. 실행 가능한 익스플로잇 단계나 의존 순서를 나타낸 것은 아니다.*

### 5.1 원인 후보와 실행 관측

초기 취약점 연구에서는 M152 코드와 수정 커밋을 나란히 놓고 `load() → Dispose() → store()`의 두 handle 해석을 먼저 확인했다. 여기서 EPT 참조가 유지되는 동안 외부 리소스의 수명이 끝날 수 있다는 가설과 `h1/h2` interleaving을 세웠다. 3.4절의 대상 일치 불변식은 이 가설을 검토할 기준을 제공한다.

공식 회귀 harness와 초기 d8 실험은 이 소스 가설을 실행으로 옮긴 단계였다. 공유 환경의 `0/약 950`을 실패 기준선으로 남긴 뒤 CPU를 분리한 ASan d8에서 3.2.2절의 판정을 만족하는 `11/150` UAF를 관측했다. 다음 질문은 **브라우저에서도 동일한 수명 관계가 깨지는가**였으며, 환경 차이와 판정 단위는 6절에서 다룬다. [3, 18]

### 5.2 브라우저의 객체 수명 검토

공유 호스트와 별도 d8 시험에서 관측 수가 달랐다는 것은 실행 조건이 해석에 중요하다는 신호였다. 함께 바뀐 조건 가운데 하나를 원인으로 단정하기보다, 어떤 사건을 세고 있는지와 관측 개입이 같았는지부터 대조해야 했다. 이 차이만으로 취약점의 존재나 부재를 확정할 수는 없었다.

브라우저에서는 페이지와 Worker의 수명, 문자열 보관 경로, 캐시와 네이티브 할당이 함께 움직인다. 따라서 d8에서 세운 해석을 옮길 때 확인할 대상도 늘어났다. **같은 종류의 증상이 보였는가**에 더해, **그 증상에 쓰인 리소스가 실제로 정리된 바로 그 객체인가**를 물어야 했다. 후속 연구 기록의 소유권·소비 경로 검토는 이 질문에 대응한다. [3]

### 5.3 데이터와 객체 수명의 구분

이 단계에서 문자열 데이터가 남아 있다는 관측은 리소스 객체도 살아 있다는 가정을 뒷받침하지 못했다. `resource_`는 리소스 객체, `resource_data_`는 문자 데이터와 관련된 참조다. 데이터가 보관되는 계약과 객체를 소유하는 계약을 구분하는 근거는 7.1절의 필드 타입과 API 계약에 있다. [17]

다른 소유자가 객체를 유지한다면 일부 참조가 사라져도 아직 수명 종료를 입증하지 못한 것이다. 반대로 객체가 종료된 뒤 데이터나 주소 값이 남았다면, 그 값이 남았다는 이유로 객체의 생존을 인정할 수 없다. 기대한 수명 종료가 확인되지 않거나 후속 소비자가 예상한 대상을 사용하지 않는 실험에서는 원래의 설명을 다시 검토해야 했다. [3]

이 검토의 결과는 **주소 변화, 문자 데이터의 가시성, 객체 정리, 실제 사용을 서로 다른 관측으로 읽는 것**이었다. 다음 판단에 필요한 것은 특정 위치에 값이 있다는 사실보다 그 값을 어느 객체와 어느 수명 구간의 상태로 해석할 수 있는지였다. 참조 카운트와 캐시를 별도로 다룬 7절은 이 판단 기준을 구체화한다.

### 5.4 중간 관측과 최종 완료

브라우저 연구 기록은 외부 네이티브 메모리 영향과 후속 동작을 검토한 내용으로 이어진다. 여기서도 외부 메모리 오류, 간접 호출에서의 관측, 파일 입출력의 완료는 각각 다른 판정이었다. CFI가 확인하는 호출 관계와 객체 생존을 분리한 8절, 디버거 개입과 실행 결과를 분리한 9절은 이 판정에 필요한 조건이다. [3]

기술 개정 자료의 근거 지도는 초기 브라우저 시험에서 최종 동작이 완료되지 않은 결과도 남긴다. 이는 중간 관측과 완료 판정을 대조하는 실패 기준선이다. 이후 로컬 완료 요약과 `hosts` 읽기에 대한 후속 확인이 추가되면서 **최종 파일 읽기까지 완료한 사례가 있다**는 결과가 남았다. 성공률의 실행 단위와 분모는 11.2~11.3절에서 다룬다. [5, 16]

따라서 연구의 연결은 UAF라는 이름에 파일 읽기 결과를 바로 붙이는 방식이 아니다. 소스에서 대상을 고정하고, 실행에서 수명 관계를 검토하고, 브라우저의 객체 정체성을 대조한 뒤, 완료 기록이 답하는 결과를 구분하는 과정이다. 11절은 마지막 결과의 근거를, 12절은 같은 원인에 대한 패치의 구현을 자세히 다룬다.

### 5.5 초기 7.33%에서 controller 단위 무실패 관측까지

초기 체인은 레이스 하나가 어려운 수준을 넘어, 같은 우연을 후속 단계에서 다시 요구하는 구조였다. 연구의 핵심 성과는 단일 race의 `p`를 100%로 만든 것이 아니라, timing-sensitive winner의 수를 줄이고 남은 실패를 격리된 재시도로 흡수한 것이다.

| 구간 | 관측 또는 단순 모형 | 의미 |
|---|---:|---|
| 공유 호스트 기준선 | `0/약 950` | 해당 환경에서는 UAF 판정 미관측 |
| CPU 격리 단일 race | `11/150` (`7.33%`) | 재현 가능한 단일 UAF 기준선 |
| 초기 3-winner prefix | 약 `1/2,536` | 같은 `p`를 세 번 요구한다고 본 단순 모형 |
| 초기 5-winner 핵심 체인 | 약 `1/471,512` | 같은 `p`를 다섯 번 요구한다고 본 단순 모형 |
| 최종 controller 캠페인 | 실행 묶음에서 실패 미관측 | 정확한 최종 `N/N` 분모는 확인되지 않음 |

표의 앞 두 행은 d8 실험에서 관측한 값이고, 가운데 두 행은 각 레이스가 서로 독립이며 같은 확률 `p = 11/150`로 성공한다고 가정한 모형값이다. 마지막 행은 최종 controller 실행 묶음에서 관측한 결과다. 모형값은 브라우저에서 직접 측정한 완주율과 구분해서 읽어야 한다.

- **고정 지연 기반 타이밍** → 네이티브 상태 기반 판정
- **반복 race** → 첫 winner와 획득 상태 재사용
- **확률적 spray** → 측정된 exact-address reclaim
- **오염된 renderer 재사용** → fresh renderer에서 제한된 횟수로 재시도

성공률 개선은 단순히 반복 횟수를 늘린 결과가 아니었다. 각 실행이 어느 단계에서 실패했는지 구분하고, 변경 후 해당 단계의 결과가 실제로 달라졌는지 확인하며 진행했다.

1. **실행 환경 분리:** 공유 호스트의 약 `0/950`과 CPU를 분리한 d8의 `11/150`을 별도 모집단으로 취급했다. 환경이 다른 수치를 합치지 않고, 레이스가 관측되는 기준선을 먼저 확보했다.
2. **의미 있는 winner만 집계:** 단순 크래시나 값 변화가 아니라, 정리된 객체와 잔존한 핸들의 관계가 기대한 상태인지 판정했다. 이 단계에서 주소 변화·객체 정리·후속 소비를 서로 다른 사건으로 기록했다.
3. **race window 축소:** 핸들을 바꾸는 구간과 취약한 정리 호출 사이에서 promise, timer, 로깅, 디버거 중단과 불필요한 할당을 제거했다. 관측 코드는 레이스 전후로 이동해 관측 자체가 스케줄을 바꾸는 영향을 줄였다.
4. **allocator 상태 분리:** dangling 참조를 보존하는 객체와 allocator 상태를 만드는 단기 객체의 수명을 분리했다. 48바이트 리소스와 후반 80바이트 네이티브 객체는 정확한 주소 재사용 여부를 각각 측정했으며, 단순히 spray 개수만 늘리지 않았다.
5. **필요한 레이스 수 축소:** 초기 설계는 같은 종류의 native-read 조건을 여러 번 다시 만들어야 했다. 후속 `read1` 설계는 첫 genuine 리소스를 직접 읽기 원시 기능으로 연결해, 연속해서 맞혀야 하는 레이스를 세 번에서 한 번으로 줄였다.
6. **실행 단위 격리:** 한 렌더러에서 실패 상태를 누적하지 않고 새 렌더러에서 다음 시도를 시작했다. 상위 제어기는 시작·타임아웃·결과 수집만 담당하게 해, 시험 대상의 힙과 allocator 상태를 매번 새로 만들었다.

이 변경들의 목적은 각 레이스를 “무조건 이기게” 만드는 것이 아니라, 우연한 상태를 다음 단계가 다시 요구하지 않도록 체인을 재구성하는 것이었다. 독립·동일확률을 가정한 단순 모형에서 필요한 레이스 수를 세 번에서 한 번으로 줄이면, `p = 11/150`을 적용한 앞부분의 성공 확률은 `p³ ≈ 1/2,536`에서 `p ≈ 1/14`로 달라진다.

초기 설계의 복잡도는 위의 단순 모형으로 비교했고, 최종 안정화 결과는 controller 실행 묶음의 관측으로 확인했다. 이 글에서 **“관측상 100%”는 최종 controller 캠페인의 실행 묶음에서 실패가 기록되지 않았다는 뜻**이다. 단일 race나 단일 renderer의 성공률이 100%가 됐다는 뜻은 아니며, 정확한 최종 `N/N` 분모가 없으므로 통계적·보편적 100%로 확장하지 않는다. 단계별 관측값은 11.3절, 전체 단순 확률표는 부록 B에 정리했다.

## 6. d8에서 브라우저로 옮겼을 때

초기에는 실행 환경에 따라 관측 결과가 크게 달랐다. 공유 호스트에서 약 950회 실행하는 동안 3.2.2절의 UAF 판정이 관측되지 않았고, CPU를 분리한 ASan d8에서는 150회 중 11회 관측됐다. 이 수치는 각각의 시험 조건과 표본에 한정해 읽어야 한다. [3]

공식 d8 회귀 테스트와 브라우저 검증은 **같은 소스 결함과 `h2 → R2` dangling 상태**를 목표로 하지만 실행 경로는 같지 않다. 회귀 테스트는 `Sandbox.MemoryView`와 d8의 `read()`로 전제를 직접 구성한다. 브라우저에서는 페이지가 만든 외부 문자열의 실제 소유권, Worker 수명, 캐시 경로와 renderer의 네이티브 allocator가 함께 작동한다. 따라서 “같은 root cause를 사용했다”와 “d8 PoC를 브라우저에서 그대로 실행했다”를 구분했다.

브라우저 기록에서 역할은 다음처럼 나뉜다.

```text
main isolate   : victim·donor와 dangling h2 holder를 유지
race Worker    : 선행 in-sandbox write로 resource_ 핸들을 경쟁적으로 변경
cohort Worker  : 종료 시 allocator cache 이동과 48바이트 재사용 조건을 형성
main isolate   : 같은 주소의 네이티브 할당과 stale consumer를 실행
```

같은 Worker가 dangling holder와 allocator 정리를 모두 맡으면 Worker 종료와 함께 필요한 참조도 사라졌다. 최종 설계는 **참조를 보존하는 수명**과 **allocator 상태를 만드는 수명**을 분리했다. Worker 종료 후 정확한 48바이트 주소 재사용이 증가하고, Worker가 살아 있는 control에서는 기대한 dispose가 나오지 않은 A/B가 이 판단을 뒷받침했다. [3, 18]

문자열 소비 경로도 따로 확인했다. cached external string은 별도의 `resource_data_` 값을 사용할 수 있어, `resource_`를 되찾았다는 사실만으로 stale consumer가 그 포인터를 읽는다고 볼 수 없었다. 후속 검증은 uncached external one-byte 경로에서 `resource_`가 제공하는 데이터를 실제로 소비하는지 대조했다. 그래서 브라우저 단계의 primitive 판정은 “같은 주소가 보였다”가 아니라 **해제 객체, exact-address reclaim, 실제 소비 경로가 같은 객체 정체성을 잇는가**를 기준으로 삼았다. [3, 17, 18]

이 구분을 거친 뒤에야 브라우저에서 관측한 native read를 동일 root cause의 후속 primitive로 연결했다. d8의 UAF 관측과 브라우저의 완료 판정은 별도로 집계했다.

## 7. 소유권과 객체 정체성을 다시 확인한 이유

브라우저 판정에서는 주소, 객체와 데이터의 생존을 분리했다. 같은 주소가 다시 보이거나 참조 카운트가 양수여도 동일 객체의 수명과 정당한 소유권이 입증되지는 않는다. 그래서 `값 변화`, `객체 해제`, `exact-address reclaim`, `후속 소비`를 별도 사건으로 기록하고, 기대한 객체 정체성을 잇지 못한 실험은 성공에서 제외했다.

### 7.1 필드 타입과 API 계약으로 캐시를 읽기

대상 리비전의 `src/objects/string.h`와 `include/v8-primitive.h`를 대조하면 문자열 리소스 객체와 문자열 데이터 주소를 더 구체적으로 구분할 수 있다. [17]

`UncachedExternalString::resource_`는 `kExternalStringResourceTag` 범위의 외부 리소스 멤버로, 리소스 객체를 참조한다. `ExternalString::resource_data_`는 `kExternalStringResourceDataTag` 범위의 외부 데이터 멤버다. 이 데이터 주소와 리소스 객체의 참조는 역할이 다르다.

`IsCacheable()`과 `Lock()`/`Unlock()`은 `data()` 주소의 캐시 여부와 안정 구간을 설명할 뿐 리소스 소유권을 만들지 않는다. `Unaccount()`는 외부 메모리 집계 콜백이고, 실제 정리는 기본 구현이 `delete this`인 `Dispose()`가 담당한다. 따라서 데이터 주소의 잔존, 집계 상태와 resource 객체의 생존을 같은 증거로 취급하지 않았다.

## 8. CFI와 메모리 안전성을 구분한 이유

CFI는 허용된 간접 호출 관계를 제한하지만, 호출에 쓰인 객체가 아직 살아 있는지는 보장하지 않는다. 따라서 CFI를 이 취약점의 루트 커즈로 다루지 않고, 후속 단계의 별도 제약으로만 기록했다. 메모리 값에 영향을 준 실행, CFI가 허용한 호출, 최종 동작까지 완료한 실행도 서로 다른 판정이다. [4]

![참조 경로, 객체 수명, 제어 흐름, OS 권한을 서로 다른 검토 항목으로 나타낸 도식](/assets/research/chrome-m152-externalstring-race/05-guarantees.svg)

*그림 5. 각 보호 기법이 다루는 속성을 분리해 본 개념도다. 특정 빌드의 모든 검사나 우회 경로를 나열한 그림은 아니다.*

대상 빌드의 모든 CFI 검사 지점을 독립적으로 재검증한 것은 아니다. 확인 범위와 빠진 검증은 9.1절에 남겼다.

## 9. 관측 도구도 실행 조건이었다

레이스를 분석하려면 중간 상태를 보고 싶어진다. 그런데 중간 상태를 보기 위해 넣은 코드나 디버거가 실행 순서에 영향을 줄 수 있다. 이번 기록에도 관측을 위한 개입과 실제 실행 결과를 분리한 내용이 남아 있다. [3]

중단점을 걸고 살펴본 상태는 원인 분석에 도움이 된다. 하지만 그 상태가 관측 도구 없이도 같은 방식으로 나타난다는 사실까지 자동으로 입증해주지는 않는다. 특히 디버거가 값을 강제로 바꾼 시험이라면, 그 이후 구간의 가능성을 확인한 것이지 앞부분까지 자연스럽게 완료됐다고 볼 수 없다.

그래서 결과를 읽을 때는 원인을 설명하기 위한 실험과 반복 실행의 결과를 측정한 실험을 나누어 보았다. 전자는 “무엇이 일어나는가”를, 후자는 “정해진 조건에서 무엇이 얼마나 관측됐는가”를 설명한다.

또한 하나의 실행 안에서도 레이스의 관측, 메모리 오류의 확인, 정해 둔 최종 동작의 완료는 서로 다른 판정이었다. 앞부분의 표시 하나만 보고 전체 실행을 성공으로 세면 후반부의 실패가 사라져 버린다.

실패 기록을 남기는 이유도 여기에 있다. 마지막 출력이 없었다는 결과만 모으면 원인을 알 수 없고, 중간 결과만 모으면 완료 여부를 알 수 없다. 어떤 주장에 어떤 기록을 붙일 것인지 먼저 정리해야 했다.

### 9.1 증거의 출처와 확인 범위

기존 기술 개정 자료의 `EVIDENCE-MAP.md`는 주장과 보고서 절을 연결했다. 이번 전면 검토 ZIP에는 그 지도에 언급된 **연구보고서와 일부 원본 체크포인트·집계 자료가 실제로 포함**되어 있다. 이를 대조한 공개 근거 요약을 Reference 18에 연결했다. [16, 18]

**직접 확인한 소스:** `Chrome VERSION → Chromium DEPS → V8 VERSION`의 연결과 대상 API 계약, 수정 리비전 `7d1fb25`의 정리·교환 함수다. 대상 소스와 수정 소스는 서로 다르다. 실행 바이너리를 확보해 SHA-256을 다시 계산하거나 빌드 옵션을 대조하지 않아, 그 바이너리와 대상 소스의 동일성은 확정하지 않았다. 수정 바이너리의 회귀 실행, M153을 포함한 배포 버전별 적용 여부와 이슈 본문의 공개 상태도 별도로 확인하지 않았다. [8–10, 15, 17]

**증상과 원인 관측:** 호출 위치, 객체의 생존, 참조의 사용, 외부 메모리 영향은 각각 대응하는 기록으로 대조한다. 새 보고서는 단순 크래시와 강제 중간 상태 이후의 실행을 전체 완료로 세지 않는 판정 기준을 명시한다. 이 글의 확인된 원인은 정리 대상의 일관성 문제이며, 소유권·캐시·CFI 검토 항목을 추가 취약점으로 세지 않는다. 공간·타입 오류와 목표 빌드의 모든 CFI 검사 지점을 별도로 확인한 결과도 아니다. [3, 4, 18]

**완료 결과와 후속 확인:** 보고서는 로컬 `/etc/hosts` 읽기 결과를 뒷받침한다. 별도 원격 검증 환경의 같은 파일 읽기는 작성자의 후속 확인에 근거하고, v147 체크포인트는 별도의 로컬 시험용 출력 기록이다. 후반 반복 검증의 전체 원시 로그와 정확한 최종 세션 수는 직접 대조하지 않았으므로, 공개 글은 분모가 확인되는 수치만 확정값으로 사용한다. 보안 경계의 해석은 11.1절에 모았다. [5, 18]

**자료 무결성과 검증 범위:** 앞선 기술 개정 ZIP의 manifest 15개 파일과 이번 전면 검토 ZIP의 `SHA256SUMS` 20개 파일은 각각 모두 일치했다. 원본 보고서가 추가됐다는 사실은 근거 확인 범위를 넓히지만, manifest 일치는 파일 무결성 검사다. 이번 편집에서 원본 PoC를 실행하거나 모든 단계를 한 실행으로 재검증하지 않았다. 공개 근거 요약의 해시도 배포한 요약 파일 자체를 식별한다. [16, 18]

## 10. 객체 수명 개념 데모

아래는 동일한 객체의 수명을 세 가지로 비교하는 **개념 모형**이다. 미리 정한 객체·참조 상태를 표시하며, 타이머는 장면을 넘기는 데만 쓴다. 실제 Chrome/V8 취약점이나 특정 패치의 회귀 테스트를 실행하지 않는다.

- **정상 정리:** 객체의 사용이 끝나면 참조도 무효화된다.
- **수명 불일치:** 객체는 종료됐지만 참조가 남아 있다. 그 불일치를 표시한다.
- **방어 불변식:** 종료된 대상을 유효하게 사용하려는 상태를 허용하지 않는다.

<!--DEMO-->

[개념 데모를 별도 창에서 열기](/assets/research/chrome-m152-externalstring-race/m152-lifetime-demo.html#ko)

데모에서 봐야 할 것은 빨간 표시 자체가 아니다. **객체의 생존 상태와 참조의 유효 상태가 같은 의미를 유지하고 있는가**다. 실제 분석에서는 이 관계를 추측으로 채울 수 없고, 관측 기록으로 확인해야 한다.

## 11. 검증 결과와 보안 경계의 범위

연구를 이어가 **승인된 로컬 환경과 작성자가 관리한 별도 원격 검증 환경에서 `/etc/hosts` 읽기까지 완료했다.** [5] 초기 d8의 UAF 관측, 브라우저의 중간 상태, 최종 파일 읽기는 서로 다른 성공 판정으로 유지했다. 그래야 어느 변경이 레이스 자체를 개선했고, 어느 변경이 후반 단계를 안정화했는지 구분할 수 있다. [18]

![증상, 원인, 결과, 관측 비율을 뒷받침하는 증거를 구분한 도식](/assets/research/chrome-m152-externalstring-race/03-evidence.svg)

*그림 6. 크래시 하나로 원인·최종 결과·반복 성공률까지 설명할 수는 없다. 각각 필요한 기록이 다르다.*

### 11.1 공개 결과의 범위

로컬 `/etc/hosts` 읽기 성공은 **승인된 시험 환경에서 사전에 정한 파일 읽기 동작까지 완료했다**는 결과다. 보고서 9절은 초기 출력과 별도의 로컬 시험용 출력을 구분하고, 14절은 디버거나 상위 프로세스의 메모리 관측에 의존하지 않은 로컬 완료 사례를 기록한다. [5, 18]

| 경계 | 공개 근거가 보여 주는 것 | 이 글의 결론 |
|---|---|---|
| V8 Sandbox 메모리 경계 | in-cage 핸들 변조가 out-of-cage 네이티브 `StringResource` UAF와 후속 primitive로 이어짐 | 분석·검증 범위에 포함 |
| Chrome renderer의 OS sandbox | 로컬 파일 읽기는 process sandbox가 비활성화된 환경에서 수행됨 | escape를 입증하지 않음 |
| OS 권한 경계 | 로컬 권한은 실행 전에 부여됨 | 권한 상승을 입증하지 않음 |
| 원격 검증 | 별도 환경에서 같은 후속 체인의 `/etc/hosts` 출력 확인 | 실행 위치에 관한 결과이며 RCE 용어로 사용하지 않음 |

공개 글에서는 빌드 전용 주소, 제어 흐름 세부와 전체 PoC를 제외했다. 대신 원인 코드, `h1/h2`의 상태 변화, 크기 클래스별 재사용 판정과 성공률 해석을 남겨 결과가 어떤 실험에 근거하는지 확인할 수 있게 했다.

### 11.2 관측값과 단순 확률 모형

초기 `11/150`을 독립·동일확률 `p`로 놓은 `pⁿ` 계산은 반복 race의 구조적 비용을 비교할 뿐 브라우저 완주율을 예측하지 않는다. 5.5절은 `p³ ≈ 1/2,536`, `p⁵ ≈ 1/471,512`에서 최종 controller 기록까지의 변화를 요약하고, 부록 B는 전체 `p¹`~`p⁶` 계산을 남긴다.

### 11.3 단계별 측정과 최종 반복 기록

관측값을 실행 환경과 측정 단위별로 정리하면 다음과 같다.

| 단계 | 관측 | 의미 |
|---|---:|---|
| 공유 호스트 d8 | `0/약 950` | 해당 환경에서 UAF 판정 미관측 |
| 분리한 d8 조건 | `11/150` | 단일 UAF 판정 7.33% |
| 초기 로컬 브라우저 | `1/20` | 그 버전의 전체 완료 표본 |
| 후반 전체 실험군 | `2/60` | upstream race를 포함한 완료 출력 |
| 후반 적격 분기 | `5/5` | 조건에 진입한 표본의 중간 설치 판정 |

`5/5`는 조건부 성공률이고 `2/60`은 전체 시행의 결과이므로 서로 바꿔 쓸 수 없다. 후반 반복 검증 기록에는 **실행 묶음 단위에서 실패가 관측되지 않았다**고 남아 있다. 다만 정확한 최종 세션 수가 확인되지 않아 확정된 `N/N`, 통계적 신뢰구간이나 보편적인 “100% 성공률”로 표현할 수는 없다. 실행 묶음에서 실패가 관측되지 않았다는 기록이 단일 레이스의 성공을 보장하는 것은 아니다. [18]

이 수치의 근거 역할도 나뉜다. 소스는 원인 계약을, 실행 기록은 객체와 사건을, 완료 기록은 최종 결과를 설명한다. 전체 출처와 확인 범위는 9.1절에 모았다.

## 12. 패치 관점에서 남는 불변식

패치가 직접 회복한 불변식은 다음 한 줄로 정리된다.

```text
disposed resource == previous payload of the EPT entry cleared by this cleanup
```

수정 전에는 `load()`와 `store()`가 서로 다른 핸들을 선택할 수 있었다. 수정 후에는 한 번 선택한 entry를 `exchange(null)`로 비우고, 그 연산이 반환한 이전 payload만 `Dispose()`한다. [8–10]

### 12.1 패치 의미를 줄인 의사코드

```text
old_resource = exchange(selected_entry, null)
if old_resource != null:
    Dispose(old_resource)
```

여기서 중요한 데이터 의존성은 `selected_entry → old_resource → Dispose`다. `exchange()`는 이 identity consistency를 보장하지만, 다른 소유자의 사용 종료를 기다리는 일반적인 lifetime 관리까지 대신하지는 않는다.

### 12.2 회귀 검증에서 확인해야 할 속성

회귀 검증에서는 다음 조건을 확인해야 한다.

- 핸들 필드는 entry 선택 시 한 번만 읽힌다.
- null로 교환한 entry와 이전 payload를 반환한 entry가 같다.
- `Unaccount()`와 `Dispose()`는 그 반환값만 사용한다.
- 이미 비워진 entry의 반복 정리가 같은 resource를 다시 해제하지 않는다.
- CAS 재시도 뒤에도 태그와 기존 GC mark가 보존된다. [10]

수정 전후 비교는 동일한 회귀 조건과 식별된 빌드에서 수행해야 한다. 이 목록은 소스에서 도출한 검증 속성이며, 이번 편집에서 수정 바이너리의 회귀 시험을 새로 실행했다는 뜻은 아니다.

수정은 리소스 추출과 null 교환을 같은 EPT entry에 묶는다. 교환되는 것은 그 entry의 payload이며 모든 힙 handle이나 외부 참조가 동시에 무효화되는 것은 아니다. compare-and-exchange 구현과 GC mark 보존을 포함한 계층별 근거는 부록 A에 남겼다. [8, 10]

## 13. 마무리

이번 연구에서 계속 따라간 질문은 결국 “지금 보고 있는 참조가, 지금도 살아 있는 같은 객체를 가리키고 있는가?”였다.

처음에는 double-fetch와 UAF라는 원인에 집중했다. 브라우저로 넘어가면서는 소유권과 객체 정체성, 제어 흐름 보호, 관측 도구의 개입까지 함께 봐야 했다. 한 단계에서 확인한 결과가 다음 단계의 결론까지 대신해주지는 않았다.

이 과정을 이어가 승인된 로컬 환경과 별도 원격 검증 환경에서 `hosts` 파일 읽기까지 완료했다. 결과의 범위는 11.1절의 경계 표를 따른다.

공개 글로 정리하면서도 이 흐름은 남기고 싶었다. 결과만 적으면 중간에 어떤 가정을 세웠고 왜 다시 확인했는지가 빠진다. 그렇다고 실패한 모든 실험을 나열하면 정작 무엇을 배웠는지 잘 보이지 않는다. 이번에는 질문이 어떻게 바뀌었는지와 그 질문에 필요한 증거를 중심으로 정리했다.

특히 보호 기법을 볼 때는 이름만 외우는 것보다 그 기법이 유지하려는 조건을 확인하는 것이 중요하다고 느꼈다. 참조를 통제하는 것, 객체의 수명을 보장하는 것, 호출을 제한하는 것은 함께 작동하지만 같은 일은 아니다.

연구 기록도 마찬가지다. “됐다”라는 한 줄보다 어떤 환경에서 무엇을 관측했고, 어디까지 확인했는지를 남겨야 나중에 다시 읽을 수 있다. 당시에는 분명 기억할 것 같았는데... 시간이 지나면 생각보다 빨리 헷갈린다.

## 부록 A. 교환 경로의 함수 전문

루트 커즈와 수정의 의미는 3.2~3.6절만으로 완결된다. 이 부록은 `exchange()`가 실제로 어느 핸들을 한 번 읽고, 어느 EPT entry의 payload를 교환하며, 이전 값을 어떻게 반환하는지 구현까지 대조하려는 독자를 위한 선택 자료다.

아래 코드는 같은 수정 리비전 `7d1fb25`에서 가져왔다. 함수 안의 문장과 원문 주석을 생략하지 않았고, 클래스 안의 오버로드는 바깥 들여쓰기만 정리했다. 이 함수들은 V8의 클래스·타입·헤더 문맥 안에서 사용된다. 좁은 화면에서는 코드 블록을 가로로 스크롤할 수 있다. [10, 13]

먼저 호출과 반환의 방향을 나누어 보겠다. 새 값과 태그는 아래 계층으로 전달되고, 이전 주소는 반환 경로를 따라 `DisposeResource`로 올라온다. 그래프 B의 두 분기는 빌드 시 선택되는 서로 다른 필드 표현이다. entry 내부의 CAS 반복은 그래프 C에서 따로 살펴본다.

![교환 helper의 호출 관계와 sandbox 빌드 분기](/assets/research/chrome-m152-externalstring-race/08-exchange-flow.ko.svg)

*코드 흐름 B. 단일 태그 오버로드에서 필드 연산으로 이어지는 호출과 빌드 분기다. 두 분기 모두 이전 주소를 반환하지만 갱신하는 저장소가 다르다.*

[확대해서 보기](/assets/research/chrome-m152-externalstring-race/08-exchange-flow.ko.svg)

#### 1. 단일 태그 오버로드

[`src/sandbox/external-pointer.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer.h#L60) · `7d1fb25`

```cpp
inline Address exchange(IsolateForSandbox isolate, Address value)
  requires(kTagRange.Size() == 1)
{
  return exchange<kTagRange.first>(isolate, value);
}
```

**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | `isolate`, 새 주소 값 `value` |
| 반환 | 태그를 명시한 멤버 오버로드의 반환값 |
| 검토점 | 태그 범위가 하나라는 정적 조건을 이용해 `kTagRange.first`를 선택한다. |

호출자는 태그를 쓰지 않았지만, 이 오버로드는 단일 태그 범위에서 `kTagRange.first`를 템플릿 인자로 선택한다. 다음 함수에는 그 태그와 `isolate`, 새 값이 전달된다. 여기에는 필드 읽기나 payload 변경이 없다. **호출 표기를 정적 태그가 있는 연산으로 연결하는 단계**다. `requires`는 컴파일 시 오버로드 선택 조건이며 객체의 생존 검사나 실행 중 동기화를 수행하지 않는다.

정리 경로에서 새 값은 `kNullAddress`다. 이 값은 아래 계층으로 내려가는 입력이고, 이전 리소스 주소는 아래 계층에서 반환되어 올라오는 결과다. 전달 방향이 반대인 두 값을 구분하면 왜 `DisposeResource`가 교환 결과를 지역 변수에 보관하는지 이해할 수 있다.

#### 2. 멤버 함수에서 필드 연산으로 전달

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L77) · `7d1fb25`

```cpp
template <ExternalPointerTagRange kTagRange>
template <ExternalPointerTag tag>
inline Address ExternalPointerMember<kTagRange>::exchange(
    IsolateForSandbox isolate, Address value) {
  static_assert(kTagRange.Contains(tag));
  return ExchangeExternalPointerField<tag>(reinterpret_cast<Address>(storage_),
                                           isolate, value);
}
```

**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | 멤버의 `storage_` 위치, `isolate`, 새 주소 값 |
| 반환 | 필드 교환이 반환한 이전 주소 값 |
| 검토점 | 필드가 저장한 값과 필드 자체의 주소를 구분한다. `static_assert`는 태그의 정적 적합성을 확인한다. |

이 단계의 데이터는 필드 주소, 새 주소 값, 실행 문맥이라는 세 가지다. `storage_`를 `Address`로 표현한 값은 **핸들을 읽을 위치**이고, 매개변수 `value`는 **교체할 포인터 값**이다. 두 값의 C++ 타입이 같아도 역할은 다르다.

`static_assert`는 태그가 멤버의 허용 범위 안에 있는지 컴파일 시 확인한다. 검증한 태그는 템플릿 인자로 전달된다. 함수는 자체적으로 필드를 읽지 않고 `ExchangeExternalPointerField<tag>`가 반환한 값을 그대로 돌려준다. 따라서 원인 분석에서는 이 전달 함수에서 새로운 리소스를 선택했다고 보지 않고, 실제 선택과 변경이 일어나는 다음 계층을 확인한다. 저장 위치의 캐스팅과 위임이 객체 소유권을 새로 만들지는 않는다.

#### 3. sandbox와 비 sandbox의 교환 경로

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L260) · `7d1fb25`

```cpp
template <ExternalPointerTag tag>
V8_INLINE Address ExchangeExternalPointerField(Address field_address,
                                               IsolateForSandbox isolate,
                                               Address value) {
#ifdef V8_ENABLE_SANDBOX
  static_assert(tag != kExternalPointerNullTag);
  ExternalPointerHandle handle =
      Relaxed_ReadExternalPointerHandle(field_address);
  return isolate.GetExternalPointerTableFor(tag).Exchange(handle, value, tag);
#else
  Address old_value = ReadMaybeUnalignedValue<Address>(field_address);
  WriteMaybeUnalignedValue<Address>(field_address, value);
  return old_value;
#endif  // V8_ENABLE_SANDBOX
}
```

**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | 필드 주소, `isolate`, 새 주소 값, 템플릿 태그 |
| 반환 | 교환 전 주소 값 |
| 검토점 | sandbox 분기의 대상은 EPT 항목이다. 비 sandbox 분기의 대상은 직접 주소를 담는 필드다. |

sandbox 분기의 교환은 선택된 항목에 새 포인터 값을 반영한다. 이 코드에는 힙 객체의 핸들 필드를 null로 덮거나 항목을 free list에 돌려주는 호출이 없다. 따라서 포인터 값이 null이 되는 것과 테이블 슬롯 자체가 삭제되는 것은 구분해야 한다.

그래프 B의 갈림길은 실행 중의 `if`가 아니라 `#ifdef`다. sandbox 빌드에서는 `field_address`에서 핸들을 한 번 얻고, 태그로 사용할 테이블을 선택한 뒤 그 핸들을 `Exchange`에 넘긴다. **테이블 선택에는 태그, 항목 선택에는 핸들**을 사용한다.

비 sandbox 빌드는 같은 위치에 주소 값이 직접 저장된다는 표현을 따른다. 기존 주소를 `old_value`로 보관하고 새 값을 쓴 뒤 `old_value`를 반환한다. 이 분기에는 EPT 조회나 entry CAS가 없으므로, sandbox 분기의 payload 원자성을 그대로 적용해 설명하지 않았다.

두 분기의 공통 인터페이스는 새 값을 반영하고 이전 주소를 반환한다는 점이다. sandbox 경로에서 바뀌는 상태는 힙 핸들 필드가 아니라 선택한 EPT 항목이다. 이 차이가 정리 대상과 갱신 대상을 대조하는 기준이 된다.

#### 4. 핸들의 원자적 읽기

[`src/sandbox/external-pointer-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h#L193) · `7d1fb25`

```cpp
#ifdef V8_ENABLE_SANDBOX
V8_INLINE ExternalPointerHandle
Relaxed_ReadExternalPointerHandle(Address field_address) {
  // Handles may be written to objects from other threads so the handle needs
  // to be loaded atomically. We assume that the access to the table cannot
  // be reordered before the load of the handle due to the data dependency
  // between the two accesses and therefore use relaxed memory ordering, but
  // technically we should use memory_order_consume here.
  auto location = reinterpret_cast<ExternalPointerHandle*>(field_address);
  return base::AsAtomic32::Relaxed_Load(location);
}
#endif
```

**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | 핸들을 저장하는 필드의 주소 |
| 반환 | 한 번의 원자적 읽기로 관측한 핸들 값 |
| 검토점 | 이 반환값은 핸들의 스냅샷이다. 이후 참조 대상의 수명이나 다른 데이터의 공개 순서를 보장하는 소유권 토큰은 아니다. |

이 함수의 책임은 핸들 값 하나를 원자적으로 읽는 것이다. 원문 주석은 테이블 접근과의 데이터 의존성을 근거로 relaxed 읽기를 선택했다고 설명한다. 이것만으로 여러 연산이 하나의 트랜잭션이 되거나 객체의 수명이 유지되지는 않는다.

`location`은 외부 리소스의 주소가 아니라 핸들 필드를 가리킨다. `AsAtomic32::Relaxed_Load`가 반환하는 것은 그 필드에서 읽은 핸들 값이다. 실제 네이티브 리소스 주소를 얻는 일은 이후 EPT 항목 연산에서 이루어진다.

따라서 이 경로에는 원자적 작업의 대상이 둘 있다. 여기서는 **힙 필드의 핸들 값**을 읽고, entry 함수에서는 **테이블 항목의 payload**를 교환한다. 둘이 각각 원자적이라고 해서 전체 함수나 모든 사용자의 수명이 하나의 원자적 구간이 되지는 않는다.

수정된 호출에서는 반환된 핸들이 지역 값으로 테이블 연산에 전달된다. entry CAS의 반복도 그 선택된 항목 안에서 이루어진다. payload 재시도와 힙 핸들의 재선택을 같은 동작으로 해석하지 않는 것이 중요하다.

#### 5. EPT에서 항목 선택

[`src/sandbox/external-pointer-table-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h#L206) · `7d1fb25`

```cpp
Address ExternalPointerTable::Exchange(ExternalPointerHandle handle,
                                       Address value, ExternalPointerTag tag) {
  DCHECK_NE(kNullExternalPointerHandle, handle);
  DCHECK(!IsManagedExternalPointerType(tag));
  uint32_t index = HandleToIndex(handle);
  return at(index).ExchangeExternalPointer(value, tag);
}
```

**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | 선택된 핸들, 새 주소 값, 태그 |
| 반환 | 선택된 항목의 교환 전 주소 값 |
| 검토점 | 항목 선택과 payload 교환을 분리해서 읽는다. 인덱스 변환은 자원 해제나 항목의 해제 작업이 아니다. |

`DCHECK`들은 이 경로가 기대하는 불변식을 표현한다. 그 문장만 보고 대상 release 빌드의 모든 실행 시 검증 범위를 확정할 수는 없다.

첫 assertion이 확인하는 null은 `kNullExternalPointerHandle`이다. 이는 새 포인터 값으로 전달한 `kNullAddress`와 역할이 다르다. **선택할 항목의 핸들은 존재해야 하지만, 그 항목에 넣을 포인터 값은 null일 수 있다.**

`HandleToIndex(handle)`는 항목 선택에 사용할 인덱스를 만들고, `at(index)`가 그 항목의 교환 함수를 호출한다. 이 함수는 리소스 정리 콜백을 실행하지 않는다. 반환은 entry 함수에서 필드 함수, 멤버 함수 순서로 올라가며 최종적으로 `DisposeResource`의 `value`가 된다.

managed 태그를 배제하는 assertion도 이 위임 경로의 전제를 보여 준다. 앞서 설명한 `ManagedResource`의 일반 설계와 이 함수의 동작을 구분해야 하는 이유다. 항목 선택과 객체 소유권 관리는 같은 연산이 아니다.

#### 6. 항목 payload의 교환

[`src/sandbox/external-pointer-table-inl.h`](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h#L70) · `7d1fb25`

```cpp
Address ExternalPointerTableEntry::ExchangeExternalPointer(
    Address value, ExternalPointerTag tag) {
  // The 2nd most significant byte must be empty as we store the tag in int.
  DCHECK_EQ(0, value & kExternalPointerTagAndMarkbitMask);

  auto old_payload = payload_.load(std::memory_order_relaxed);
  while (true) {
    DCHECK(old_payload.ContainsPointer());
    Payload new_payload(value, tag);
    if (old_payload.HasMarkBitSet()) {
      new_payload.SetMarkBit();
    }
    if (payload_.compare_exchange_weak(old_payload, new_payload,
                                       std::memory_order_relaxed)) {
      MaybeUpdateRawPointerForLSan(value);
      return old_payload.Untag(tag);
    }
  }
}
```

![EPT entry의 mark 보존과 weak CAS 재시도 흐름](/assets/research/chrome-m152-externalstring-race/09-entry-cas.ko.svg)

*코드 흐름 C. 실패 시 expected 상태로 후보를 다시 구성하고, 성공 시 이전 payload의 주소를 반환한다. 반복은 선택된 한 entry 안에서 이루어진다.*

[확대해서 보기](/assets/research/chrome-m152-externalstring-race/09-entry-cas.ko.svg)


**입출력 계약**

| 구분 | 내용 |
|---|---|
| 입력 | 새 주소 값과 기대 태그 |
| 반환 | 성공한 CAS 직전 payload를 태그에 맞게 해석한 이전 주소 값 |
| 검토점 | 포인터 값, 태그, mark를 포함하는 한 payload의 교체가 원자적 작업의 단위다. |

첫 `DCHECK`는 새 주소 값이 payload의 태그·mark용 비트와 겹치지 않아야 한다는 전제를 표현한다. 루프의 `ContainsPointer()`는 관측한 payload가 포인터를 담는 상태인지 확인하는 assertion이다. 주소 표현과 payload 상태에 대한 전제이며, 리소스 생존이나 객체 소유권을 검사하는 연산은 아니다.

이 CAS가 묶는 범위는 한 EPT 항목의 payload다. 힙 객체의 핸들 필드 전체나 여러 외부 객체를 한꺼번에 동기화한다고 범위를 넓혀 읽으면 안 된다.

반복문의 입력으로 쓰이는 `old_payload`는 첫 relaxed load에서 얻은 기대값이다. `Payload(value, tag)`는 호출자가 요청한 새 포인터와 태그로 교체 후보를 만들고, 관측한 이전 payload의 mark가 설정되어 있으면 후보에도 mark를 설정한다. 새 후보를 반복문 안에서 만드는 것은 **실패 후 갱신된 expected 상태를 다시 반영하기 위해서**다.

CAS가 성공하면 **그 한 항목의 교체가 확정되는 지점**이 된다. 이때 `old_payload`는 성공 직전의 이전 payload를 유지하므로 `old_payload.Untag(tag)`가 이전 주소를 반환할 수 있다. `new_payload`에서 주소를 꺼내 반환하는 코드와는 의미가 다르다. 이 원자적 갱신과 호출자가 반환된 리소스를 안전하게 사용하는 계약은 별도로 검토한다.

CAS가 실패하면 다음 반복은 expected 인자로 갱신된 `old_payload`를 사용한다. weak CAS의 일시적 실패도 이 경로로 처리한다. 다시 만드는 것은 선택된 entry의 payload 후보이며, 힙 필드에서 다른 핸들을 다시 읽는 루프가 아니다. [14]

`MaybeUpdateRawPointerForLSan(value)`는 성공한 분기 안에서 새 값을 기준으로 호출된다. 이전 포인터를 반환하는 것과 LSan 보조 상태에 새 값을 반영하는 것 역시 구분한다. 이 함수에는 `Dispose()` 호출이 없으며, 실제 리소스 정리는 반환을 받은 상위 함수의 역할이다. LSan 보조 상태의 갱신이 객체 소유권을 획득하는 것도 아니다.

원문 출처: V8 project authors, Copyright 2017 / 2020 / 2021. 코드의 BSD-style 라이선스와 원문 저작권 고지는 [라이선스 파일](/assets/research/chrome-m152-externalstring-race/v8-source-license.txt)에 함께 제공한다. [13]

## 부록 B. 단순 확률 모형

격리된 d8에서 관측한 단일 UAF 비율 `p = 11/150`을 독립·동일확률이라고 가정한 계산이다.

```text
P(N개의 연속 winner) = (11 / 150)^N
평균 시도 수          = (150 / 11)^N
```

| 연속 winner 수 | 단순 모형 확률 | 평균적으로 약 |
|---:|---:|---:|
| 1 | 7.3333% | 14회 중 1회 |
| 2 | 0.53778% | 186회 중 1회 |
| 3 | 0.039437% | 2,536회 중 1회 |
| 4 | 0.0028920% | 34,578회 중 1회 |
| 5 | 0.00021208% | 471,512회 중 1회 |
| 6 | 0.000015553% | 6,429,711회 중 1회 |

각 행의 마지막 값은 이미 `1/pⁿ`으로 계산한 누적 평균 시도 수다. `14 × 186 × 2,536`처럼 행별 분모를 다시 곱하지 않는다. 이 모형은 초기 설계 비교용이며 실제 브라우저 완주율이 아니다.

## Reference

1. [V8 — The V8 Sandbox](https://v8.dev/blog/sandbox). 보호 목적과 외부 참조에 관한 공식 배경 자료.
2. [Chromium — Sandbox](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md). OS 기반 프로세스 격리의 목적에 관한 공식 자료. 세부 설계 설명은 Windows 중심이다.
3. 첨부된 연구 패키지의 블로그 원문, 상세 연구보고서, 초기 d8 관측 메모, 브라우저 진행 기록, 최종 체크포인트 및 패치 수명 검토 메모. 본문의 사례와 수치는 이 비공개 기록을 기준으로 했다.
4. [Clang — Control Flow Integrity](https://clang.llvm.org/docs/ControlFlowIntegrity.html). CFI 검사의 일반적인 의미에 관한 공식 자료.
5. 작성자의 후속 확인: 작성자가 관리한 별도 원격 검증 환경에서 `/etc/hosts` 읽기까지 완료했다. 이는 실행 위치를 설명하며 RCE나 Chrome OS sandbox escape 판정으로 사용하지 않는다. `RESEARCH_REPORT.md` 9·14절은 로컬 `/etc/hosts` 읽기 결과를 뒷받침한다. v147 체크포인트는 별도의 로컬 시험용 출력 기록이다. 공개 근거 요약은 Reference 18에 연결했다.
6. [V8 공개 API 헤더 — v8-primitive.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/include/v8-primitive.h). 2026년 10월 1일 조회한 main의 공개 API 계약과 기본 정리 구현을 구조 설명에 사용했다.
7. [V8 — external-pointer-table.h](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/sandbox/external-pointer-table.h). 2026년 10월 1일 조회한 main의 EPT 설계 설명. 타입·시간적 안전성의 설계 의도를 확인하는 배경 자료다.
8. [V8 수정 커밋 — 7d1fb25](https://github.com/v8/v8/commit/7d1fb25f99755c0380cb386e591a532efd7d2b03). 이슈 `532204454`를 명시한 외부 문자열 정리 수정. 커밋 설명, `exchange()` 변경과 `--sandbox-testing`·`Sandbox.MemoryView`·Worker를 사용하는 `regress-532204454.js`를 직접 확인했다.
9. [V8 — string-inl.h, 수정 리비전](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/objects/string-inl.h). `DisposeResource`의 코드와 역할 설명에 사용했다. 함수 전체를 원문에서 옮겼다. 아래 코드도 같은 리비전으로 고정했다.
10. V8 수정 리비전의 [external-pointer-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-inl.h) 및 [external-pointer-table-inl.h](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer-table-inl.h). 교환 연산의 위임 관계, EPT payload와 GC mark 처리를 확인했다.
11. [V8 — assert-scope.h, 수정 리비전](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/common/assert-scope.h). `DisallowGarbageCollection`이 debug-only assertion 스코프임을 확인했다.
12. [V8 — v8-primitive.h, 수정 리비전](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/include/v8-primitive.h). 해당 리비전의 `Unaccount` 콜백 계약과 기본 구현을 확인했다.
13. [V8 — external-pointer.h, 수정 리비전](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/src/sandbox/external-pointer.h)와 [원문 라이선스](https://github.com/v8/v8/blob/7d1fb25f99755c0380cb386e591a532efd7d2b03/LICENSE). 클래스 안의 단일 태그 오버로드와 코드 재사용 조건을 확인했다.
14. [C++ working draft — atomic operations](https://eel.is/c++draft/atomics.types.operations). compare-and-exchange의 expected 인자 갱신과 weak CAS의 일시적 실패 가능성에 관한 일반적인 언어 계약을 확인했다.
15. 대상 소스의 [Chromium VERSION](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/chrome/VERSION), [Chromium DEPS](https://github.com/chromium/chromium/blob/506c834ecceaa943c5f41e6cfe7f68acb5c45346/DEPS), [V8 버전 헤더](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-version.h), [upstream tag 15.2.124.18](https://chromium.googlesource.com/v8/v8/+/refs/tags/15.2.124.18). 버전·리비전 연결과 tag의 2026년 8월 24일 기록을 직접 확인했다.
16. 작성자가 제공한 `m152-blog-technical-revision.zip`의 `TECHNICAL-REVIEW.md`, `EVIDENCE-MAP.md`, `PUBLICATION-CHECKLIST.md`, `SOURCE-INDEX.md`. 대상 정보와 주장별 근거·수치 해석을 보강하는 편집 자료다. manifest 확인 결과는 9.1절에 기록했다.
17. 대상 V8 리비전의 [string.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/src/objects/string.h) 및 [v8-primitive.h](https://github.com/v8/v8/blob/6aacaf6256a069ee455142333b7d38cad1c8d6e0/include/v8-primitive.h). 리소스·데이터 멤버의 타입, 캐시 가능성, 잠금·정리 콜백 계약을 직접 확인했다.
18. 작성자가 제공한 `m152-blog-full-review-20261001.zip`의 전면 개정 검토서, `RESEARCH_REPORT.md`, 로컬 체크포인트·진행 기록 및 최종 아카이브 설명. [공개 근거 요약](/assets/research/chrome-m152-externalstring-race/evidence-summary.ko.md) · [영문 요약](/assets/research/chrome-m152-externalstring-race/evidence-summary.en.md) · [요약 파일 SHA-256](/assets/research/chrome-m152-externalstring-race/evidence-summary.SHA256SUMS). 원본 실행 자료의 주장과 이번 편집의 대조 범위를 구분했다.
