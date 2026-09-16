---
title: "[PWNABLE] .bss 확인하기"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 메모리 구조를 다루면서 bss에 대한 초기화 되지 않은 변수들이 저장되는 영역이다라고 설명을 했었다. 앞으로 다양한 기법을 다루기에 해당 세그먼트가 중요하다. bss 세그먼트의 위치를 찾는 방법은 readelf라는 명령어를 사용하면 된다. reade"
date: "2023-11-07"
translation_key: "tistory-3e7f3a390222"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-bss-%ED%99%95%EC%9D%B8%ED%95%98%EA%B8%B0"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

메모리 구조를 다루면서 bss에 대한 초기화 되지 않은 변수들이 저장되는 영역이다라고 설명을 했었다.

앞으로 다양한 기법을 다루기에 해당 세그먼트가 중요하다.

bss 세그먼트의 위치를 찾는 방법은 readelf라는 명령어를 사용하면 된다.

```
readelf -S [파일명]
```

![](/assets/images/tistory/tistory-3e7f3a390222/001.png)

매핑된 영역들을 확인해보면 bss 영역이 있는 것을 확인할 수 있다.

![](/assets/images/tistory/tistory-3e7f3a390222/002.png)

bss 세그먼트의 주소는 0x404040인것을 확인할 수 있다.

여기서 bss 세그먼트가 중요한 이유는 쓰기가 가능한 영역이라는 것이다.

권한을 보면 WA인데 아래 테이블을 확인해보면 된다.

![](/assets/images/tistory/tistory-3e7f3a390222/003.png)

읽기가 가능한 이유가 중요한 이유는 해당 영역에 /bin/sh라는 문자열을 넣어두고 이용하면 공격에 사용될 수 있기 때문이다.
