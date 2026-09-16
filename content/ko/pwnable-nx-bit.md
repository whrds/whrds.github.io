---
title: "[PWNABLE] NX bit"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ BOF 하면서 포스팅했어야 하는데 순서가 좀 틀렸네요;; No eXecute bit의 약자로 스택 영역에 실행권한을 부여하지 않는 것이다. 비교를 위해 같은 c파일을 2가지 방법으로 컴파일 했다. non_ex 파일은 NX bit가 비활성화 된 상태이"
date: "2023-10-22"
translation_key: "tistory-14caa6c4e322"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-NX-bit"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

BOF 하면서 포스팅했어야 하는데 순서가 좀 틀렸네요;;

No eXecute bit의 약자로 스택 영역에 실행권한을 부여하지 않는 것이다.

![](/assets/images/tistory/tistory-14caa6c4e322/001.png)

비교를 위해 같은 c파일을 2가지 방법으로 컴파일 했다.

non\_ex 파일은 NX bit가 비활성화 된 상태이고,

tomato 파일은 활성화 되있는 상태이다.

먼저 활성화 되있는 tomato를 살펴보면

![](/assets/images/tistory/tistory-14caa6c4e322/002.png)

스택 부분의 권한을 보면 실행 권한인 x가 빠진 것을 알 수 있다.

이어서 non\_nx파일을 살펴보면

![](/assets/images/tistory/tistory-14caa6c4e322/003.png)

실행권한 x가 들어가 있는 것을 알 수 있다.

이때 스택영역에서 우리가 공격을 위해 사용할 수 있는 것은

셸코드 같은 바이트 코드이다.

여기서 셸코드가 아닌 다른 문자열도 바이트 코드로 인식을 해버리는 경우

셸코드가 정상적인 기능을 수행하지 못하는 경우도 있다.

이런 경우를 위해 NOP Sled라는 기법이 존재한다.

어셈블리어에서 NOP의 기능은 다음 명령어로 넘기는 것이다.

즉, 셸코드 앞뒤로 NOP을 패치해준다면 셸코드를 실행하는데 있어서

방해되는 요소들을 예방할 수 있다.
