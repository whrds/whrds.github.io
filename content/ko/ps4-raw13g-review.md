---
title: "[PS4] raw13g 코드 분석"
description: "raw13g의 파일 구조부터 주요 함수, Worker 통신과 로그 처리까지 코드를 따라가며 정리해보았다."
date: "2026-10-05"
translation_key: "ps4-raw13g-review"
tags: ["PS4", "WebKit", "Code Review", "Firmware", "Supply Chain"]
category: "STUDY/FirmWare 분석(시도)"
private: false
---

이번에는 PS4에서 사용하는 `raw13g`의 코드를 정리해보겠다.

실행 결과에 GoldHEN이 표시됐다는 기록은 있었지만, 화면만 봐서는 각 파일이 어떤 역할을 하는지 알기 어려웠다. JavaScript 파일도 여러 개로 나뉘어 있고, 별도로 불러오는 바이너리도 있었다. 우선 파일들이 어떻게 연결되는지부터 보고, 주요 함수에서 어떤 값을 받아 다음 단계로 넘기는지 살펴보았다.

코드를 읽다 보니 버전 문자열을 다루는 방식이나 로그를 출력하는 부분도 눈에 들어왔다. 이런 부분은 실행 결과만 확인했을 때 지나치기 쉽기 때문에 함께 정리하도록 하겠다.

## 1. 분석 대상

분석한 코드는 `raw13g/raw13g.github.io`다. 같은 저장소라도 코드가 바뀔 수 있으므로 기준으로 삼은 커밋을 남겨둔다. [1]

```text
Repository: raw13g/raw13g.github.io
Revision: 9ba2f0719591d6900d91aba6cc5291f8fff97e6d
```

먼저 소스와 함께 수집된 배포 파일을 비교해보았다. 읽고 있는 코드와 배포 파일이 같은 내용인지 확인하기 위해서다.

| 확인한 항목 | 결과 | 의미 |
|---|---|---|
| `MANIFEST.sha256` | 목록의 **48개 파일 모두 일치** | 함께 보관된 해시 목록과 파일이 일치함 |
| `source/`와 `deployed/` | 대응하는 **15개 파일 모두 동일** | 수집된 소스와 배포 파일의 내용이 같음 |
| JavaScript 구문 검사 | 기존 기록에 **6개 파일 PASS** | 구문 검사 결과이며 실제 동작 확인과는 별개 |

48개는 문서와 검사 기록까지 포함한 수이고, 15개는 웹 배포 파일만 비교한 수다. 매니페스트 자체와 Git 내부 파일은 48개에 포함되지 않는다.

여기서 확인한 것은 파일 내용이 서로 같다는 점이다. 파일과 해시 목록을 함께 바꿀 수도 있기 때문에 해시가 맞는다는 이유만으로 제작자까지 확인되는 것은 아니다. 이 부분은 뒤에서 바이너리를 살펴볼 때 다시 이어진다.

![파일 비교, 실행 결과와 제작자 확인이 각각 무엇을 보여주는지 정리한 그림](/assets/research/ps4-raw13g-review/01-evidence-ko.svg)

*그림 1. 파일이 같은지, 실제로 동작했는지, 누가 만든 파일인지는 따로 확인해야 한다.*

## 2. 전체 구조와 주요 함수

먼저 파일별 역할부터 나누어보겠다. `index.html`은 처음 보이는 화면이고, `jb.html`은 진행 상태를 보여주는 페이지다. 그 안에서 실제 JavaScript 모듈을 연결하는 파일은 `jb.js`다. 다른 모듈을 불러오고 Worker와 통신하며, 필요한 외부 파일도 이곳에서 받는다. [2]

![진입 페이지와 JavaScript 모듈의 연결 관계](/assets/research/ps4-raw13g-review/04-modules-ko.svg)

*그림 2. 화면에서 시작해 각 파일이 어떻게 연결되는지 정리하였다.*

| 파일 | 받는 값·상태 | 역할 |
|---|---|---|
| `index.html` | User-Agent, 캐시 상태 | 펌웨어 표시와 다음 페이지 이동 |
| `jb.html` | DOM 요소, 모듈 스크립트 | 진행 화면과 `jb.js`의 실행 환경 |
| `ps4_offsets.js` | User-Agent 문자열 | 버전 키와 설정 객체 조회 |
| `int64.js` | 하위·상위 32비트 값 | 64비트 값 표현, 연산과 문자열 변환 |
| `core.js` | 브라우저 환경, 옵션, 이벤트 콜백 | 브라우저 메모리 기능을 묶은 carrier 구성 |
| `mem.js` | carrier, 설치 옵션 | 다른 코드에서 사용할 공통 메모리 인터페이스 제공 |
| `rpc_worker.js` | ID, 함수 이름, 인자를 담은 메시지 | 같은 ID를 붙인 결과 또는 오류 응답 |
| `jb.js` | 설정, 모듈 결과, Worker 응답, 파일 응답 | 전체 흐름 제어와 로그 기록 |
| `cache.appcache` | 자원 경로, 캐시 규칙 | 오프라인 자원 목록과 네트워크 처리 설정 |

아래에서는 주요 함수를 원문과 함께 살펴보겠다. 함수 일부만 가져온 경우에는 해당 블록의 역할을 따로 설명하고, `core.js`와 `mem.js`는 모듈 사이에서 주고받는 객체와 인터페이스를 중심으로 읽었다.

### 2.1 `index.html`과 `jb.html`: 시작 화면에서 하는 일

`index.html`에서 먼저 눈에 들어온 부분은 버전을 읽는 코드다. User-Agent에서 숫자 두 묶음을 찾은 뒤 `key`와 `fwnum`을 만든다.

*`index.html` · L49–L56*

```javascript
var key = null, fwnum = null;
var m = /PlayStation\s+4[\/ ](\d+)\.(\d+)/.exec(navigator.userAgent);
if (m) {
    var ms = parseInt(m[2], 16).toString(16);
    if (ms.length < 2) ms = "0" + ms;
    key = m[1] + "." + ms;
    fwnum = parseInt(m[1], 10) * 100 + parseInt(ms, 10);
}
```

`13.52`를 예로 들어보겠다. 두 번째 숫자 묶음은 `"52"`인데, 이를 16진수로 읽고 다시 16진수 문자열로 바꾸므로 `ms`에는 그대로 `"52"`가 남는다. 이후 `fwnum`을 만들 때는 10진수로 계산하여 `1352`가 된다.

처음 보면 같은 버전을 왜 두 가지로 만드는지 궁금할 수 있다. `key`는 설정을 찾거나 화면에 표시할 때 쓰는 문자열이고, `fwnum`은 시작 화면의 지원 목록과 비교할 때 쓰는 숫자다. 같은 입력에서 용도에 맞는 값을 따로 만드는 것이다.

다만 입력은 어디까지나 User-Agent다. 이 코드가 기기의 펌웨어 파일이나 커널 버전을 직접 읽는 것은 아니므로, **버전 표기를 정리하는 처리**로 이해하면 된다.

다음은 `jb.html`의 모듈 진입점이다.

*`jb.html` · L156–L158*

```html
<script type="module">
  import "./jb.js?v=19";
</script>
```

HTML에는 스타일과 화면 요소가 길게 들어 있지만, 기능이 시작되는 위치를 찾으려면 이 선언을 보면 된다. `jb.html`이 상태를 표시할 DOM을 준비하고 `jb.js`를 모듈로 불러오는 구조다. 뒤에 붙은 `?v=19`는 자원 URL을 구분하는 값으로, 파일의 내용이나 제작자를 확인하는 값은 아니다.

### 2.2 `offsetsFor()`: 버전에 맞는 설정 찾기

버전 문자열을 만들었다면 이제 그에 맞는 설정이 필요하다. `ps4_offsets.js`의 조회 함수는 다음과 같다.

*`ps4_offsets.js` · L647–L653*

```javascript
export function offsetsFor(uaString) {
  const m = (uaString || "").match(/PlayStation\s+4[\/ ](\d+)\.(\d+)/);
  if (!m) return { key: null, off: null };

  const key = m[1] + "." + parseInt(m[2], 16).toString(16).padStart(2, "0");
  return { key, off: PS4[key] || null };
}
```

반환하는 값은 `{ key, off }`다. 예상한 문자열 형식이 아니면 둘 다 `null`이고, 형식은 맞지만 `PS4` 테이블에 항목이 없으면 `key`는 남고 `off`만 `null`이 된다.

때문에 호출하는 쪽에서는 버전 자체를 읽지 못한 것인지, 버전은 읽었지만 설정이 없는 것인지 구분할 수 있다. 짧은 함수지만 반환값을 둘로 나눈 이유를 여기서 볼 수 있다.

이 함수가 하는 일은 설정 조회까지다. 테이블에 값이 들어 있다는 것만으로 그 값이 실제 기기에서도 맞는지는 알 수 없다. 지원 목록은 `index.html`에, 설정은 `ps4_offsets.js`에 나뉘어 있으므로 두 파일의 설명도 함께 봐야 한다. 이 부분은 4절에서 다시 정리하겠다.

### 2.3 `core.js`와 `mem.js`: 기능을 만들고 인터페이스로 감싸기

`jb.js`의 맨 위에는 다음과 같은 import가 있다.

*`jb.js` · L1–L4*

```javascript
import { establishPrimitive } from "./core.js?v=10";
import { installWindowP, pairStatus } from "./mem.js";
import { int64 } from "./int64.js";
import { offsetsFor } from "./ps4_offsets.js";
```

`establishPrimitive()`는 비동기 작업의 결과로 carrier라는 객체를 제공한다. 여기서 carrier는 뒤의 코드가 사용할 브라우저 측 메모리 기능을 묶은 객체라고 보면 된다. `installWindowP()`는 이 객체를 받아 공통 인터페이스를 만들고 전역 `p`로 노출한다. `pairStatus`는 같은 모듈의 상태를 나타낸다.

이름만 보면 복잡하지만, 역할을 나누어보면 다음과 같다.

| 구분 | `core.js` | `mem.js` |
|---|---|---|
| 맡은 일 | 브라우저 환경에 맞는 기반 기능 구성 | 다른 코드에서 쓸 수 있도록 API로 감싸기 |
| 밖으로 전달하는 것 | 준비 결과와 이벤트 | 일정한 형태의 함수와 상태 |
| 나누어 둔 이유 | 기반 구현을 한곳에 모음 | 호출부마다 내부 표현을 반복해서 다루지 않게 함 |

이렇게 나누어두면 호출하는 쪽은 내부 구현을 매번 알 필요가 없다. 다만 API로 감쌌다고 해서 접근 가능한 주소 범위를 제한하는 샌드박스가 하나 더 생기는 것은 아니다. `globalThis.p`는 같은 페이지에서 실행되는 다른 스크립트도 접근할 수 있기 때문에, 함께 불러오는 스크립트의 신뢰도도 중요해진다.

즉, 여기서 보이는 분리는 기능을 구성하는 코드와 사용하는 코드를 정리하기 위한 것으로 이해했다. 인터페이스가 존재한다는 사실과 그 안의 기능이 기대대로 동작한다는 사실까지 같아지는 것은 아니다.

### 2.4 `int64.js`: 64비트 값을 나누어 보관하는 이유

JavaScript의 일반적인 `Number`로는 모든 64비트 정수를 정확하게 표현할 수 없다. 때문에 이 파일에서는 하위 32비트인 `low`와 상위 32비트인 `hi`를 따로 보관한다. 아래는 생성자에서 필드를 초기화하는 부분이다.

*`int64.js` · L12–L16*

```javascript
this.low = low >>> 0;

this.hi = hi >>> 0;

this.backing = null;
```

`>>> 0`은 입력을 부호 없는 32비트 값으로 바꾼다. 두 필드가 나타내는 실제 수는 `hi × 2³² + low`다. `backing`은 따로 연결할 바이트 뷰를 위한 필드로, 숫자 값과는 구분된다.

연산 함수도 이름을 보면 차이가 있다. `inplace`가 붙은 함수는 현재 객체의 값을 바꾸고, `add32()`처럼 별도 결과를 만드는 함수는 새 객체를 반환한다. 값을 읽는 것뿐 아니라 원래 객체가 바뀌는지도 함께 봐야 하는 이유다.

여기서 한 가지 더 살펴볼 부분은 문자열 변환이다. 다음은 `toString()` 전체다.

*`int64.js` · L100–L112*

```javascript
this.toString = function (radix = 16) {
  let lo_str = (this.low >>> 0).toString(radix);
  let hi_str = (this.hi >>> 0).toString(radix);

  if (this.hi == 0) {
    return lo_str;
  } else {
    const width = radix === 16 ? 8 : Math.ceil(32 / Math.log2(radix));
    lo_str = zeroFill(lo_str, width);
  }

  return hi_str + lo_str;
};
```

기본값인 16진수에서는 하위 값을 8자리로 채운 뒤 상위 값 뒤에 붙인다. 16진수 한 자리는 4비트이므로 하위 32비트가 정확히 8자리를 차지한다. 이 경우에는 두 문자열을 붙이는 방식이 맞다.

그렇다면 다른 진법에서도 같을까? `hi=1`, `low=0`을 넣어보면 차이가 드러난다. 두 필드가 나타내는 수는 `4294967296`인데, 10진수 모드에서는 하위 문자열을 10자리로 채운 뒤 `1`을 붙여 `10000000000`이 된다.

| 필드 | 진법 | 코드가 만드는 문자열 | 올바른 문자열 |
|---|---|---|---|
| `hi=1`, `low=0` | 16 | `100000000` | `100000000` |
| `hi=1`, `low=0` | 10 | `10000000000` | `4294967296` |

계산을 따라가면 확인할 수 있는 **표시 함수의 문제**다. 이것만으로 실제 체인이 실패했다고 볼 수는 없다. 다만 인자로 여러 진법을 받을 수 있다고 해서 모든 진법에서 올바르게 변환되는 것은 아니라는 점을 알 수 있다.

### 2.5 `makeRpc()`: Worker 응답을 기다리는 방식

`jb.js`는 Worker와 메시지를 주고받는다. 이때 `makeRpc()`가 Worker를 받아 호출용 함수를 만들어준다. 여기서 RPC는 다른 컴퓨터의 서버가 아니라, 같은 페이지의 메인 스레드와 Worker 사이에서 쓰는 호출 형식이다.

*`jb.js` · L662–L693*

```javascript
function makeRpc(wk, name) {
  let seq = 0;
  const pending = new Map();
  wk.onmessage = function (e) {
    const d = e.data || {};
    const slot = pending.get(d.id);
    if (!slot) return;
    pending.delete(d.id);
    if (slot.timer) clearTimeout(slot.timer);
    if (d.type === "err") slot.reject(new Error(String(d.value)));
    else slot.resolve(d.value);
  };
  wk.onerror = (e) =>
    mark(
      "WORKER-ONERROR",
      name + " " + (e && e.message ? e.message : String(e)),
    );
  return function call(fname, timeoutMs, ...args) {
    return new Promise(function (resolve, reject) {
      const id = seq++;
      const timer =
        timeoutMs > 0
          ? setTimeout(function () {
              pending.delete(id);
              reject(new Error(name + ": timeout waiting for " + fname));
            }, timeoutMs)
          : null;
      pending.set(id, { resolve, reject, timer });
      wk.postMessage({ id: id, name: fname, args: args });
    });
  };
}
```

핵심은 `pending`이라는 `Map`이다. 요청마다 증가하는 `id`를 붙이고, 그 ID에 Promise의 `resolve`, `reject`, 타이머를 연결해둔다. Worker에는 `{ id, name, args }`를 보내고, 같은 ID가 붙은 응답이 돌아오면 기다리던 Promise를 찾는다.

응답 처리 순서도 보겠다. 먼저 `pending`에서 항목을 지우고 타이머를 해제한다. 그 뒤 `type`이 `"err"`면 `reject`, 그 외에는 `resolve`로 값을 전달한다. 이미 끝난 요청의 ID가 다시 들어오면 대응하는 항목이 없으므로 무시한다. 늦게 도착하거나 중복된 응답을 정리하는 방식이다.

![요청 ID로 Worker 응답과 Promise를 연결하는 흐름](/assets/research/ps4-raw13g-review/05-rpc-ko.svg)

*그림 3. `id`를 기준으로 응답이 어느 요청에 대한 것인지 찾는다.*

반대편인 `rpc_worker.js`에서는 메시지의 함수 이름과 인자를 읽고, `api`에서 함수를 찾아 호출한 뒤 `{ id, type, value }`로 응답한다. 양쪽이 같은 ID와 응답 형식을 사용해야 이 연결이 맞아떨어진다.

읽으면서 확인한 점은 두 가지다. 요청 ID는 호출을 구분하는 번호이지 권한을 증명하는 값이 아니다. 이 코드는 같은 페이지에서 만든 Worker를 신뢰하며, 인자의 의미나 응답의 세부 형식을 별도로 검사하는 계층은 보이지 않는다.

또한 `wk.onerror`는 오류를 기록하지만 기다리던 Promise를 즉시 모두 종료하지는 않는다. 타임아웃도 지정하지 않았다면 이 함수만으로 호출이 반드시 끝난다고 보장하기 어렵다. 여기서는 메시지가 연결되고 종료되는 조건을 짚은 것이며, 외부에서 이용할 수 있는 취약점을 확인한 것은 아니다.

### 2.6 파일 로딩: 응답을 바이트 배열로 바꾸기

다음은 선택된 파일을 받아오는 블록이다.

*`jb.js` · L3023–L3028*

```javascript
try {
  const r = await fetch(PAYLOAD_FILE);
  if (r.ok) payloadBlob = new Uint8Array(await r.arrayBuffer());
} catch (e) {
  mark("PAYLOAD-FETCH-THREW", (e && e.message) || String(e));
}
```

`fetch()`로 받은 응답의 `r.ok`가 참이면 본문을 `arrayBuffer()`로 읽고, 이를 `Uint8Array`로 감싼다. `Uint8Array`는 받은 파일을 바이트 단위로 다루기 위한 뷰다. 이후 코드에서 쓰기 편한 형태로 준비하는 부분이라고 보면 된다.

여기까지는 파일을 받는 처리다. `arrayBuffer()`나 `Uint8Array`가 파일의 의미를 해석하거나 제작자를 확인해주는 것은 아니다. HTTP 응답이 성공했는지와 기대한 내용의 파일인지는 따로 확인해야 한다. 이 차이는 5절의 바이너리 부분으로 이어진다.

전체적으로 보면 `jb.js`는 **설정을 선택하고, 모듈을 연결하고, 비동기 응답과 외부 파일을 받아 흐름을 이어가는 역할**을 한다. 이 구조를 먼저 잡아두면 뒤의 코드를 읽을 때도 각 기능이 어느 파일에 있는지 찾기 편하다.

## 3. 취약점 이름과 원인

관련 자료에는 이 체인을 “1-day”라고 부르는 표현이 있다. 다만 그 표현만으로 각 단계가 어떤 CVE에 대응하는지까지 알 수는 없었다. 그래서 여기서는 공개된 체인의 코드를 읽는 데 초점을 맞췄다. [1, 2]

커널 측 코드에는 비동기 I/O와 객체 수명 경쟁을 다루는 부분이 있다. 비동기 작업에서는 요청한 쪽의 코드가 끝나도 다른 실행 주체가 같은 객체를 사용하고 있을 수 있다. 때문에 UAF를 볼 때는 취소나 완료 표시뿐 아니라 **그 객체를 사용하는 마지막 작업이 끝났는지**를 봐야 한다.

이런 관점으로 코드 구조를 이해할 수는 있지만, 정확한 원인을 확정하려면 취약한 커널 함수와 수정 코드, 실행 추적을 함께 봐야 한다. 이번 자료에는 그 근거가 충분하지 않았다.

상태 문자열의 `bug=663`도 내부 표기일 뿐 CVE 식별자는 아니다. 비슷한 유형의 코드라는 이유만으로 특정 CVE 번호를 붙이지는 않았다.

## 4. 펌웨어별 지원 상태

시작 화면에는 `13.02`, `13.04`, `13.50`, `13.52`가 지원 목록으로 들어 있다. 우선 이것은 화면에 적힌 목록이며, 네 버전을 모두 실기기에서 확인했다는 뜻은 아니다. [2]

`ps4_offsets.js`에는 더 많은 버전의 항목이 있다. 설명을 보면 실기기 확인, 오프라인 확인, 미검증 상태가 섞여 있다. 단순히 항목이 있는지만 보면 이 차이를 놓칠 수 있다.

| 표기 | 알 수 있는 내용 | 추가로 필요한 정보 |
|---|---|---|
| UI 지원 목록 | 시작 화면에서 지원 대상으로 분류함 | 각 구성요소의 실기기 시험 결과 |
| 설정 항목 존재 | 해당 버전 키에 값이 있음 | 실제 기기에서 값이 정확한지 |
| 오프라인 검증 | 작성자가 정적 자료로 확인했다고 기록함 | 실제 실행 결과 |
| 실기기 검증 | 작성자가 기기에서 확인했다고 기록함 | 원시 로그, 시험 횟수와 조건 |

구체적으로 눈에 들어온 부분은 `13.52`다. 실제 payload 필드에는 `goldhen.bin`이 들어 있지만 상태 설명에는 `payload2.bin`이 남아 있다. 두 파일을 비교해보니 크기는 모두 293,120바이트였고 내용도 같았다. 따라서 비교한 파일에서는 이름 차이가 다른 바이트를 선택하는 문제로 이어지지는 않았다. [1, 2]

그래도 설명과 실제 값이 다르다는 점은 남는다. 나중에 두 파일 중 하나가 바뀌면 로그만 보고 어떤 파일을 사용했는지 잘못 판단할 수 있기 때문이다. 이런 부분은 실행 파일 이름과 상태 설명을 함께 관리해야 한다.

## 5. 바이너리 파일은 어디까지 확인했나

JavaScript를 읽다 보면 별도로 불러오는 바이너리에서 확인할 수 있는 범위가 달라진다. 로더가 파일을 다루는 방식은 볼 수 있지만, 그것으로 바이너리 내부 동작까지 설명할 수는 없다. [1, 2]

`goldhen.bin`과 `payload2.bin`은 다음과 같이 동일했다.

```text
Size: 293120 bytes
SHA-256: df3f27c1b35bc7c40e3a08caab948930914dc7d0301a73b68945cf6ffe40ea12
```

세 개의 patch 바이너리는 각각 632바이트였다. 크기와 해시는 어떤 파일을 보고 있는지 구분할 때 유용하다. 다만 파일 식별기가 출력한 형식 이름이나 해시만으로 내부 동작을 판단할 수는 없다.

로더에는 응답 상태, 일부 형식 조건과 복사 결과를 확인하는 코드가 있다. 반면 읽어본 JavaScript에서는 신뢰할 수 있는 기대 해시나 제작자 서명을 기준으로 파일을 승인하는 경로를 찾지 못했다. **받은 바이트가 정확히 복사됐다는 것과, 그 바이트를 누가 만들었는지는 다른 문제다.**

![파일 비교와 제작자·내부 동작 확인의 차이](/assets/research/ps4-raw13g-review/02-trust-ko.svg)

*그림 4. 각 검사가 무엇을 확인해주는지 나누어보았다.*

자료에는 바이너리를 소스에서 다시 만들 수 있는 완결된 빌드 자료나 제작자 서명, 구성요소 목록이 없었다. 따라서 바이너리 내부와 출처에 대해서는 판단을 남겨두었다. 이것이 곧 악성 파일이라는 뜻은 아니다.

`LICENSE`도 함께 확인했다. raw13g가 작성한 코드는 MIT를 적용하지만 payload, patch와 일부 primitive 파일은 제3자 구성요소로 따로 설명한다. 저장소에 라이선스 파일이 하나 있다고 해서 모든 파일에 같은 조건이 적용되는 것은 아니라는 점도 확인할 수 있었다.

## 6. 캐시에 적힌 해시의 의미

`cache.appcache`를 보면 자원 경로 뒤에 `#`와 해시 문자열이 붙어 있다. 처음 보면 파일 검증에 쓰는 값처럼 보일 수 있다. 하지만 AppCache가 이 문자열을 파일 내용의 기대 해시로 비교하는 것은 아니다. 명세의 파싱 규칙과 파일 처리 코드를 함께 보면, 해시를 적어두는 것과 실제로 검사하는 처리를 구분할 수 있다. [2, 6]

캐시는 이전에 받은 파일을 계속 사용할 수도 있다. 때문에 같은 URL을 열었다고 항상 같은 파일을 사용했다고 보기는 어렵다. 이런 경우에는 URL뿐 아니라 파일의 해시와 적용된 자원 버전도 같이 확인해야 한다.

네트워크 설정은 다음과 같다.

*`cache.appcache` · L21–L22*

```text
NETWORK:
*
```

`NETWORK: *`가 있으므로 오프라인 캐시를 사용한다는 이유만으로 모든 네트워크 요청이 막히는 구성은 아니다. 여기까지는 설정에서 읽을 수 있는 내용이며, 실제 기기에서 캐시 갱신이나 요청 동작을 따로 측정한 결과는 아니다.

## 7. 로그 처리 코드

로그도 화면에 문자열을 찍는 것에서 끝나지 않았다. `terse()`, `mark()`, `post()`, `trace()`를 따라가면 화면에 보이는 값과 전송하는 값이 나뉜다. 하나씩 살펴보겠다. [2]

### 7.1 `terse()`: 화면에 보여줄 문자열 줄이기

다음은 `terse()` 전체다. `VERBOSE`와 `PROSE`는 함수 밖에 있는 표시 옵션과 정규식 목록이다.

*`jb.js` · L39–L49*

```javascript
function terse(s) {
  if (VERBOSE || s == null) return s;
  s = String(s);
  for (const re of PROSE) {
    const m = re.exec(s);
    if (m && m.index > 0) s = s.slice(0, m.index);
  }
  s = s.replace(/\s+$/, "");
  if (s.length > 140) s = s.slice(0, 140) + "...";
  return s;
}
```

먼저 `VERBOSE`가 켜져 있거나 값이 `null`이면 그대로 반환한다. 그 외에는 문자열로 바꾼 뒤 `PROSE`의 정규식마다 처음 일치하는 위치를 확인한다. 일치한 위치가 0보다 크면 그 뒤를 잘라낸다. 마지막으로 뒤쪽 공백을 지우고, 140자가 넘으면 말줄임표를 붙인다.

결국 문자열의 형태와 길이를 기준으로 줄이는 함수다. IP나 토큰, 사용자 식별자를 찾아 지우는 처리는 없다. 화면의 글자가 짧아졌다고 민감한 정보까지 제거됐다고 볼 수는 없다.

### 7.2 `mark()`: 화면용 값과 원문을 나누기

다음은 `mark()`다.

*`jb.js` · L64–L89*

```javascript
function mark(tag, detail) {
  const raw = detail;
  detail = terse(detail);
  lines.push(tag + (detail == null || detail === "" ? "" : "  " + detail));
  if (SHOW_LOG && outEl) {
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    outEl.innerHTML = lines
      .map(function (l) {
        l = esc(l);
        const c =
          /FAIL|ERROR|THREW|REBOOT|MISS|LOST|POISON|TIMEOUT|MISMATCH|ABORTED|GIVEUP|NO-STORAGE|UNSEEN/i.test(
            l,
          )
            ? "bad"
            : /WARN|SKIP|REFUS|COMMITTED|DIRTY/i.test(l)
              ? "warn"
              : /\bOK\b|\bPASS\b|PASS=|ACHIEVED|RUNNING|ARMED/i.test(l)
                ? "ok"
                : "";
        return c ? '<span class="' + c + '">' + l + "</span>" : l;
      })
      .join("\n");
    outEl.scrollTop = outEl.scrollHeight;
  }
  post(tag, raw);
}
```

첫 줄을 보면 원래 `detail`을 `raw`에 따로 남겨둔다. 그다음 화면에 쓸 값만 `terse()`로 줄이고 `lines`에 추가한다. 화면 로그가 켜져 있으면 각 줄을 이스케이프한 뒤, 키워드에 따라 CSS 클래스를 붙여 출력한다.

`innerHTML`을 사용한다는 점도 보인다. 다만 이것만 보고 문자열이 그대로 HTML로 해석된다고 판단하면 안 된다. `esc()`에서 `&`를 먼저 바꾸고 `<`를 바꾸며, 그 결과는 `span`의 텍스트 내용으로 들어간다. 클래스 이름도 입력값을 그대로 쓰는 것이 아니라 코드에 정해진 값 중에서 선택한다. 어느 위치에 문자열을 넣는지와 그 전에 어떤 처리를 하는지를 같이 봐야 한다.

여기서 주목한 부분은 마지막의 `post(tag, raw)`다. 전송 함수에는 화면에서 줄인 `detail`이 아니라 처음 남겨둔 원문이 들어간다. **화면에 보이는 내용과 전송하는 내용이 달라지는 지점**이다.

### 7.3 `post()`와 `trace()`: 로그가 보이지 않아도 전송하는가

`post()`를 보면 어디로 어떤 값을 보내는지 알 수 있다.

*`jb.js` · L15–L27*

```javascript
function post(tag, detail) {
  try {
    const x = new XMLHttpRequest();
    x.open("POST", "/t", true);
    x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    x.send(
      "PS4-JB&tag=" +
        encodeURIComponent(tag) +
        "&detail=" +
        encodeURIComponent(String(detail == null ? "" : detail)),
    );
  } catch (e) {}
}
```

목적지는 같은 출처의 `/t`다. `tag`와 `detail`을 `encodeURIComponent()`로 인코딩하여 폼 형식의 본문에 넣는다. `detail`이 `null`이면 빈 문자열로 바꾼다.

이 인코딩은 수신 측에서 원래 문자열로 되돌릴 수 있다. 암호화나 익명화 처리가 아니라 요청에 값을 담기 위한 표현이다.

또한 비동기 XHR을 시작하지만 응답을 처리하는 콜백은 없다. 바깥의 `try/catch`는 호출 중 발생한 예외를 처리할 뿐, 나중에 도착하는 HTTP 응답의 성공 여부를 알려주지는 않는다.

이제 `trace()`까지 연결해서 보겠다.

*`jb.js` · L91–L94*

```javascript
function trace(tag, detail) {
  if (VERBOSE) mark(tag, detail);
  else post(tag, detail);
}
```

`VERBOSE`가 켜져 있으면 `mark()`로 가고, 꺼져 있으면 곧바로 `post()`를 호출한다. 앞에서 본 것처럼 `mark()`도 마지막에 `post()`를 호출한다. 결국 자세한 화면 표시를 끄더라도 전송을 시도하는 경로는 남는다.

![로그 원문이 화면 표시와 네트워크 전송으로 나뉘는 흐름](/assets/research/ps4-raw13g-review/03-logging-ko.svg)

*그림 5. 화면에서는 줄인 값을 사용하고, 전송 함수에는 원문을 넘긴다.*

여기서 확인한 것은 요청을 시도하는 코드까지다. `/t`를 처리하는 서버가 실제로 있는지, 수신에 성공했는지, 받은 내용을 저장하는지는 별도로 확인해야 한다. 펌웨어 정보나 진단 상태를 로그에 넣는 호출부가 있다고 해서 실제 수집까지 확인된 것은 아니다.

## 8. 포트 상태로 확인한 내용

코드와 함께 남아 있던 TCP 연결 기록도 살펴보았다. 두 번의 결과는 다음과 같다. [3]

| 포트 | 17:15 KST | 17:29 KST | GoldHEN 문서의 역할 |
|---|---|---|---|
| `2121/tcp` | closed | open | FTP |
| `3232/tcp` | open | open | Klog |
| `9090/tcp` | closed | open | BinLoader |

포트와 역할은 GoldHEN 문서의 설명과 맞는다. 다만 포트 번호가 같다고 그곳에서 동작하는 프로그램까지 확인되는 것은 아니다. [4]

Nmap에서 `open`은 검사한 지점에서 연결을 수락했다는 의미다. 이 기록은 TCP 연결 여부까지 확인한 것이므로, 17:29에 세 포트가 연결을 받았다는 점을 알 수 있다. 어떤 구현이 어떤 권한으로 동작했는지, 전체 체인이 매번 성공하는지까지는 설명하지 못한다. [5]

반대로 처음에 두 포트가 닫혀 있었다고 바로 체인 실패라고 볼 수도 없다. 서비스가 켜져 있는지와 전체 실행 결과는 구분해야 한다. 서비스를 다시 열었다는 기록은 뒤의 상태 변화와 맞지만, 이 두 번의 결과만으로 내부 과정을 전부 알 수는 없다.

## 9. 정리

이번에는 `raw13g`의 파일 구조를 먼저 나누고 주요 함수를 따라가보았다. `jb.js`가 설정, 모듈, Worker와 외부 파일을 연결하고, 나머지 파일이 각 기능을 맡는 구조였다.

| 코드 | 맡은 역할 | 읽으면서 확인한 점 |
|---|---|---|
| `offsetsFor()` | 버전 키로 설정 조회 | 설정이 있다는 것과 실제 환경에서 맞는지는 별개 |
| `core.js` / `mem.js` | 기반 기능과 사용 API 분리 | 전역 인터페이스는 같은 페이지의 다른 스크립트도 접근 가능 |
| `int64.toString()` | 두 32비트 값을 문자열로 변환 | 16진수의 결합 방식을 일반 진법에 그대로 적용하기 어려움 |
| `makeRpc()` | 요청 ID와 Promise 연결 | 응답 형식과 대기 호출의 종료 조건을 함께 봐야 함 |
| 파일 수신 블록 | 응답 본문을 바이트 뷰로 준비 | 다운로드 성공만으로 내용이나 제작자가 확인되지는 않음 |
| `mark()` / `post()` | 화면 표시와 전송 분리 | 화면에서 줄인 정보가 전송 단계에서는 그대로 남을 수 있음 |

처음에는 파일이 여러 개라는 점이 눈에 들어왔지만, 역할별로 나누고 나니 어떤 값이 어디로 넘어가는지 보기 쉬워졌다. 특히 숫자를 문자열로 만드는 작은 함수나 로그를 줄이는 코드도 이름만 보고 넘기면 실제 동작과 다르게 이해할 수 있다는 점이 기억에 남았다.

별도 바이너리의 내부는 이번 JavaScript 리뷰만으로 확인할 수 없는 부분이다. 여기까지는 코드에서 직접 읽은 동작과 기존 실행 기록을 바탕으로 정리하였다.

## 참고 자료

1. 분석 자료의 `README.md`, `PROVENANCE.md`, `MANIFEST.sha256` 및 [분석 기준 커밋](https://github.com/raw13g/raw13g.github.io/tree/9ba2f0719591d6900d91aba6cc5291f8fff97e6d). 소스와 배포 파일 비교는 함께 수집된 사본을 기준으로 했다.
2. `source/`의 HTML·JavaScript·AppCache·`LICENSE`, `CODE_REVIEW.md`, `REPORT.md`. 코드 발췌의 파일명과 줄 번호는 이 소스를 기준으로 한다.
3. `PORT_CHECK.md`와 `evidence/`의 구문 검사·TCP 연결 기록. 포트 표는 2026년 10월 5일의 기존 기록이며 새로 측정한 결과는 아니다.
4. [GoldHEN 프로젝트 문서](https://github.com/GoldHEN/GoldHEN): FTP·Klog·BinLoader 기능과 포트 설명.
5. [Nmap — Port Scanning Basics](https://nmap.org/book/man-port-scanning-basics.html): `open`·`closed` 상태의 의미.
6. [W3C HTML5 — Offline Web applications](https://dev.w3.org/html5/spec-LC/offline.html): AppCache 매니페스트와 네트워크 처리 규칙.
