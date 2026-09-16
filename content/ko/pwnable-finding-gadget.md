---
title: "[PWNABLE] Gadget 찾기"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ gadget이 무엇인지 이전 RTL에서 다음과 같이 설명을 해두었다. 2023.10.22 - [STUDY/PWNABLE] - [PWNABLE] RTL 일반적으로 '코드 조각'을 의미한다. 이렇게만 보면 이게 무슨 소리인가 싶을 것이다. ret 가젯을"
date: "2023-11-07"
translation_key: "tistory-b1bf11c8e44d"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Gadget-%EC%B0%BE%EA%B8%B0"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

gadget이 무엇인지 이전 RTL에서 다음과 같이 설명을 해두었다.

[2023.10.22 - \[STUDY/PWNABLE\] - \[PWNABLE\] RTL](https://whrdud727.tistory.com/22)

> 일반적으로 '코드 조각'을 의미한다.  
> 이렇게만 보면 이게 무슨 소리인가 싶을 것이다.  
>   
> ret 가젯을 예로 설명하겠다.  
> ret 가젯은 말 그대로 ret 명령을 실행하기 위한 코드 조각이다.  
>   
> 이렇게 disassemble을 했을 때 pop rdi, rsi, ret 등의 코드들이 있을 것인데  
> 이 부분을 코드 조각 즉 '가젯'이라고 한다.

이제 이 가젯을 찾는 방법을 다뤄보겠다.

가젯을 찾는 방법에는 대표적으로 ROPgadget이 있다.

```
sudo pip3 install ropgadget
```

위 명령을 입력하면 설치가 가능하다.(pip3를 미리 설치해야한다.)

![](/assets/images/tistory/tistory-b1bf11c8e44d/001.png)

이미 설치가 되있는 상태이기 때문에 이러고 뜨지만 처음 설치하는 상황이면 정상적으로 실행이 된다.

사용 방법은 간단하다. 

옵션으로 binary 파일을 분석하겠다고 선언해주면 된다.

```
ROPgadget --binary [파일명]
```

![](/assets/images/tistory/tistory-b1bf11c8e44d/002.png)

명령을 수행하면 많은 가젯들이 보일 것이다.

이 가젯들 중에 친숙한 pop | rdi 가젯이 보일 것이다.

![](/assets/images/tistory/tistory-b1bf11c8e44d/003.png)

rdi, rsi를 변조하기 위한 가젯이 있는것을 확인할 수 있다.

바이너리 파일마다 가젯의 유무가 차이가 있다는 점 알아둬야 한다.

여기서 원하는 부분만을 보기 위해서는 'grep'을 사용하면 된다.

```
ROPgadget --binary [파일명] | grep [찾을 가젯]
```

![](/assets/images/tistory/tistory-b1bf11c8e44d/004.png)
