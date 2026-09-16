---
title: "[AArch64] PAC"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Pointer Authentication CodePointer를 서명하여 올바른 메모리 주소라는 무결성을 보장해주는 ARMv8.3 에서 추가된 보안 기법이다. amd64를 포함하여 대부분의 stack에서의 취약점은 [ret]를 변조하여 수행한다. 가"
date: "2024-04-08"
translation_key: "tistory-176b1d39004b"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-PAC"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※**  
   
 

* * *

### Pointer Authentication Code

Pointer를 서명하여 올바른 메모리 주소라는 무결성을 보장해주는 ARMv8.3 에서 추가된 보안 기법이다.  
   
amd64를 포함하여 대부분의 stack에서의 취약점은 \[ret\]를 변조하여 수행한다.   
가장 대표적으로 rop 등이 있는데, 이는 바이너리의 call flow를 변경하는 취약점에 해당한다.  
aarch64를 기준으로 봤을 때 해당 취약점은 br이라는 어셈블리어로 다른 함수들을 호출하여 call flow에 영향을 준다.  
이를 막고자 Pointer Address에 무결성을 체크하여 call flow를 변경할 수 없게하여 바이너리가 의도한 대로 실행되게 하게 도와주는 기술이 PAC이다.  
 

* * *

![](/assets/images/tistory/tistory-176b1d39004b/001.png)

PAC를 생성할 때 Key, Context, Pointer 이렇게 3개의 값이 필요하다.  
   
Key는 인증코드를 생성하는 역할을 수행하는데 pointer type, privileged level에 따라서 구분이 된다.

-   Insruction key
    -   APIAKey, APIBKey
    -   제어 흐름에 관련된 pointer에 PAC를 적용할 때 사용
-   Data key
    -   APDAKey, APDBKey
    -   일반 데이터 pointer에 PAC를 적용할 때 사용(객체 포인터, 일반 변수 포인터 등)
-   Generic key
    -   APGAKey
    -   시스템 전체에서 공통적으로 사용될 수 있는 pointer에 PAC를 적용할 때 사용

   
각 키를 보면 키의 구성은 같은데 A와 B로 나뉘는 것을 볼 수 있다.  
A는 user mode, B는 kernel mode를 의미한다.  
   
128bit의 key를 정의하고 있으며 이를 알고리즘을 통해 연산하여 PAC 값을 생성한다.  
   
이때 사용되는 알고리즘은 QARMA라는 알고리즘으로 symmetic block cipher 알고리즘이다.  
   
   
key 레지스터들과 함께 사용되는 system register들을 살펴보겠다.  
 

#### Key register

위에서 언급했던 5개의 key마다 low, hight bit로 구분하여 구성된 register가 있다.

![](/assets/images/tistory/tistory-176b1d39004b/002.png)

#### SCR (Secure Configuration Register)

EL3에서만 접근 가능한 API bit, APK bit를 추가한다.  
API : instruction fault 발생 시 EL3로 trap한다.  
APK : key register 접근이 발생 시 EL3로 trap한다.  
그리고 해당 상황들을 ESR\_ELx.EC에 기록한다.  
전체적으로 보안 정책을 구성 및 상호 작용을 제어하는 역할을 수행하는 register이다.  
 

#### SCTLR (System Control Register)

시스템의 동작 모드를 제어하는데 사용하며 기본적으로 부팅할 때 기본값으로 설정된다.  
이후 캐시, 엔디언 모드 등의 설정을 할 때 변경될 수 있다.  
 

#### ESR (Exception Syndrome Register)

예외 발생 시 해당 예외에 대한 상세한 정보를 제공한다.  
 

* * *

   
   
PAC가 적용되고 나면 각 함수의 prologue와 epilogue에 instrucion이 추가된다.  
 

![](/assets/images/tistory/tistory-176b1d39004b/003.png)![](/assets/images/tistory/tistory-176b1d39004b/004.png)

왼쪽이 PAC 적용 전, 오른쪽이 적용 후의 모습이다.  
 

```
pacibsp

...

autibsp
```

위와 같은 명령어가 추가된 것을 볼 수 있다.  
   
   
우선 기본적인 pac\*, aut\*로 시작되는 명령어 부터 살펴보겠다.  
pac\* : keyed MAC을 삽입하는 용도로 사용되는 명령어로 계산 결과 값을 Target Pointer Address의 Top byte에 위치시킨다.  
aut\* : Pointer Address에 있는 Keyed MAC을 검증하는 용도로 사용된다.  
   
이때 Keyed MAC 검증 결과가 거짓이라면 canary가 변조되었을 때처럼 비정상 종료가 발생하게 된다.  
   
   
다시 위의 명령어인 pacibsp, autibsp를 살펴보면 sp값을 context르 사용하여 PAC 값을 생성하는 구조이다.  
정확히는 Instruction key B로 lr의 PAC를 계산하는데, 이때 context는 sp 레지스터의 값을 사용하겠다라는 말이 된다.  
반대로 autibsp도 위의 과정으로 생성된 PAC를 검증하는 단계이다.  
이렇게 생성된 address를 살펴보면 다음과 같다.

![](/assets/images/tistory/tistory-176b1d39004b/005.png)

0x5500800088 주소를 보면 주소 앞에 0x78이 부텅있는 것을 볼 수 있다.  
이 값이 PAC 값이다.  
   
   
   
 

* * *

**PAC, MTE는 추가로 자료를 찾고 있습니다만... 이게 real world에서 어떻게 bypass가 되는지 공부 중에 있습니다.**
