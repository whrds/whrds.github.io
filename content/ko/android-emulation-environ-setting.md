---
title: "[Android] Emulation - Environ Setting"
description: "계속해서 공부하면서 지식의 폭을 넓혀보고자 이쪽도 한번 공부해보고자 한다.(공부하고 싶은게 너무 많은데...) 휴대폰 루팅하는 것에 대해서는 천천히 공부 및 실습을 해보고 나서 다뤄볼 예정이다.이번 게시글에서는 Android Studio를 통해 에뮬레이팅하여 shell 및 burp suite 붙이는 방법에 대해 다루겠다."
date: "2026-01-07"
translation_key: "tistory-8e958806759e"
tags: ["STUDY/Android"]
category: "STUDY/Android"
source_url: "https://whrdud727.tistory.com/entry/Android-Emulation-Environ-Setting"
private: false
---

계속해서 공부하면서 지식의 폭을 넓혀보고자 이쪽도 한번 공부해보고자 한다.

(공부하고 싶은게 너무 많은데...)

휴대폰 루팅하는 것에 대해서는 천천히 공부 및 실습을 해보고 나서 다뤄볼 예정이다.

이번 게시글에서는 Android Studio를 통해 에뮬레이팅하여 shell 및 burp suite 붙이는 방법에 대해 다루겠다.

일단 설치해줄 것들이 좀 있는데...

```
brew install jadx

# Android Studio 설치
https://developer.android.com/studio?hl=ko 

# 향후 분석을 위한 후킹용 frida 준비
pip3 install frida
pip3 install frida-tools

# apk 관련 툴 설치
brew install apktool
```

대충 위에 것들 설치를 진행하고 향후 필요한 툴들은 추가로 설치하면 된다.

참고로 작업환경이 MAC이기 때문에 brew를 통해 진행하였다.

![](/assets/images/tistory/tistory-8e958806759e/001.png)

jadx의 경우 jadx-gui를 통해 향후 android에 대한 분석을 진행할 수 있다.

![](/assets/images/tistory/tistory-8e958806759e/002.png)

에뮬레이팅은 Android Stuido를 통해 진행할 수 있는데 \[Tools -> Device Manager\]을 통해 설정할 수 있다.

![](/assets/images/tistory/tistory-8e958806759e/003.png)

에뮬레이팅을 할 때에는 원하는 기종을 선택하여 진행하면 된다.

(해당 이미지에서는 이전 CTF용 문제를 위해 구축했던 환경을 그대로 가져왔다)

```
sudo ln -s /Users/<User ID>/Library/Android/sdk/platform-tools/adb /usr/local/bin/adb
```

Android Studio에서는 이제 adb라는 명령을 통해 내부 셸에 접속하곤 한다. 

이에 편의성을 위해 심볼릭 링크를 설정해준다.

![](/assets/images/tistory/tistory-8e958806759e/004.png)

```
adb devices
```

에뮬레이팅이 되었다면 해당 명령을 통해 device 리스트를 조회할 수 있다.

![](/assets/images/tistory/tistory-8e958806759e/005.png)

```
adb shell
```

내부 셸로도 접근이 가능하다! 

Android도 IoT와 마찬가지로 네트워크 트래픽을 분석하는 경우도 있다고 한다.

이에 burp suite를 통해 분석할 수 있는 환경을 구축하고자 한다.

![](/assets/images/tistory/tistory-8e958806759e/006.png)

먼저 burp suite에서 \[proxy -> settings\]에 들어가서 All interfaces가 접근 가능하도록 포트 하나를 설정해준다.

이후 에뮬레이팅된 휴대폰 설정에서 proxy 설정을 진행해준다.

![](/assets/images/tistory/tistory-8e958806759e/007.png)

이런식으로 설정을 해주면 되는데, 여기까지만 하면 인터넷에 접속했을때 아래처럼 정상적으로 페이지 접속이 되지 않을 것이다.

![](/assets/images/tistory/tistory-8e958806759e/008.png)

인증서 때문에 발생하는 것이기 때문인데 현재 proxy를 burp suite로 설정을 해주었으므로 해당 인증서를 가져와 설치해주면 된다.

```
http://burp
```

![](/assets/images/tistory/tistory-8e958806759e/009.png)

우측 상단에 \[CA Certificate\]를 클릭하여 인증서 설치를 진행해준다.

der 확장자이기 때문에 adb로 붙은 셸 내부에서 cer 확장자로 변경해준다.

![](/assets/images/tistory/tistory-8e958806759e/010.png)

이후 휴대폰 설정에서 인증서 설치를 진행해주면 된다.

![](/assets/images/tistory/tistory-8e958806759e/011.png)

여기까지 진행하면 burp suite에서 정상적으로 내부 트래픽에 대한 분석이 가능해진다.

![](/assets/images/tistory/tistory-8e958806759e/012.png)

이제 루팅 공부하고 1-Day, CTF 문제들을 기반으로 공부를 진행해볼 예정이다!
