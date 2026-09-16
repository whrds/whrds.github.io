---
title: "[PWNABLE] FPO"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Frame Pointer Overflow (간략하게 설명)sfp를 변조하는 것으로, 결과적으로 보았을 때, IP 레지스터를 변조하는 기법이다.sfp 영역에 최소 1바이트 이상의 overflow가 가능해야 한다.main()이외의 함수가 필요하다. 이 "
date: "2024-06-24"
translation_key: "tistory-f391d7d86e68"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FPO"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

#### Frame Pointer Overflow (간략하게 설명)

sfp를 변조하는 것으로, 결과적으로 보았을 때, IP 레지스터를 변조하는 기법이다.

-   sfp 영역에 최소 1바이트 이상의 overflow가 가능해야 한다.
-   main()이외의 함수가 필요하다.

이 기법은 Epilogue 때문에 가능하다. leave - ret는 이전 함수의 sfp를 복구하고, return을 수행한다.

각 구성을 제대로 살펴보면 아래와 같다.

```
leave
	- mov esp, ebp
	- pop ebp

ret
	- pop eip
	- jmp eip
```

간단한 그림을 가지고 살펴보겠다.

![](/assets/images/tistory/tistory-f391d7d86e68/001.png)

일반적으로 함수가 호출되면 위와 같은 구조를 지니게 된다.

이제 여기에 FPO를 시행해보겠다.

![](/assets/images/tistory/tistory-f391d7d86e68/002.png)

먼저 mov esp, ebp 코드가 실행되는 부분이다. 실행되기전에 sfp의 1 byte를 변조되었다.

EBP와 ESP가 같은 위치를 가리키고 있다.

![](/assets/images/tistory/tistory-f391d7d86e68/003.png)

이후 pop ebp를 수행한다.

여기서 문제가 발생하게 된다. stack에 저장된 sfp를 그대로 ebp로 옮기는데 이때 그림과 같이 stack의 한 공간으로 설정을 하게되면 ret이후 해당 sfp부터 사용하게 된다.

![](/assets/images/tistory/tistory-f391d7d86e68/004.png)

그리고 나서 ret과정을 수행한다.

여기까지보면 실행자체에서 크게 문제 될 것은 안보일 수도 있다.

![](/assets/images/tistory/tistory-f391d7d86e68/005.png)

다시 func 함수가 실행되고 에필로그 과정을 거치는 과정에서 앞에서 만들었던 문제점이 터지게 된다.

leave-ret 과정은 동일하니 설명은 생략하겠다.

첫 에필로그 단계 이전에 buf에 shellcode를 입력하고 바로 이전의 주소값으로 sfp를 변조한다면 두번째 에필로그 단계에서 shellcode가 실행이 된다.
