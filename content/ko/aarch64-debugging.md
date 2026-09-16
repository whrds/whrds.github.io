---
title: "[AArch64] Debugging"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 디버깅하는 방법을 앞에서 언급을 했지만 해당 방법으로는 동적 디버깅을 수행할 수 없다. 이번 게시글에서는 동적 디버깅을 수행하는 방법을 다루겠다. (직접 시행착오하며 겪은 것을 바탕으로 작성하는 것이기 때문에 더 효율적인 방법이 있을 수도 있다.) "
date: "2024-03-23"
translation_key: "tistory-14d4a184d653"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Debugging"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

디버깅하는 방법을 앞에서 언급을 했지만 해당 방법으로는 동적 디버깅을 수행할 수 없다.

이번 게시글에서는 동적 디버깅을 수행하는 방법을 다루겠다.

(직접 시행착오하며 겪은 것을 바탕으로 작성하는 것이기 때문에 더 효율적인 방법이 있을 수도 있다.)

* * *

[https://whrdud727.tistory.com/34](https://whrdud727.tistory.com/34)

 [\[AArch64\] x86\_64 간단 비교

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 효율적인 전력 사용과 높은 성능의 위해서 설계된 architecture이다. 주로 스마트폰, 임베디드 시스템 등의 환경에서 사용

whrdud727.tistory.com](https://whrdud727.tistory.com/34)

먼저 위 게시글에서 다룬 방법이다.

```
gdb-multiarch -q ./a.out
```

gdb-multiarch를 사용하여 생성된 파일을 실행한다.

여기서는 SYMBOL이 모두 살아있는 상태이기 때문에 info func을 통해 함수 확인 및 분석이 쉽다.

![](/assets/images/tistory/tistory-14d4a184d653/001.png)

* * *

동적으로 디버깅을 하기 위해서는 qemu-user-static을 사용해야 한다.

```
sudo apt-get install qemu-user-static
```

위 명령을 이용해서 설치해준다.

![](/assets/images/tistory/tistory-14d4a184d653/002.png)

설치하고 나면 architecture별로 설치가 되어있는 것을 볼 수 있다.

```
 qemu-aarch64-static -g 1234 [binary_file_name]
```

\-g 옵션을 활용하여 사용할 포트를 지정한다. 이 방법으로 1234라는 포트 번호를 가지고 GDB 서버를 실행하게 된다.

이후 다른 터미널에서 접속을 수행해주면 된다.

```
gdb-multiarch
gef-remote --qemu-user --qemu-binary [binary_file_name] localhost 1234
```

gdb-multiarch에 접속하고 나서 gef-remote를 활용하여 접속한다.

이때 1234는 앞에서 열었던 GDB 서버의 포트이다.

![](/assets/images/tistory/tistory-14d4a184d653/003.png)

이렇게 접속을 하고나면 Debugging 창이 뜨게 된다.

여기서 또 하나의 터미널을 열어서 앞서 했던 방법으로 GDB를 하나 더 열어준다.

```
gdb-multiarch -q ./a.out
```

해당 창에서 main()을 비룻한 다른 필요 함수들의 주소를 확인하고 동적 디버깅을 위해 서버에 연결한 터미널에서 bp 설정 및 분석을 해주면 된다.

![](/assets/images/tistory/tistory-14d4a184d653/004.png)

이렇게 총 3개의 Debugging을 위한터미널을 열어서 분석을 수행한다.

(일반적으로 비어있는 남은 터미널 창에서는 payload파일을 즉석으로 작성 및 실행하는 목적의 터미널을 실행한다.)

정리하면 현재 사용하고 있는 방식은 아래와 같은 방식으로 열어서 사용한다.

1\. 페이로드 작성을 위한 터미널

2\. 함수 / symbol에 대한 주소 및 정보를 위한 정적분석 터미널

3\. gdb-server을 열기위한 터미널

4\. 동적 분석을 위한 터미널

\[더 좋은 방법이 있다면 알려주세요;;\]
