---
title: "[Android] Rooting in MAC OS"
description: "안드로이드에 대한 루팅 방법은 레퍼런스들이 많이 공개되어 있고 정리되어 있다. 대부분 ODIN이라는 친구를 사용한다.이 친구는 삼성 내부용 플래싱 툴로 알려져 있고, GUI를 지원하기 때문에 손쉽게 다룰 수 있다.하지만 아쉽게도 윈도우 환경만 지원해주기 때문에... (내가 MAC 용을 못 찾은 건가) MAC을 사용하기 때"
date: "2026-01-10"
translation_key: "tistory-c0a04e263161"
tags: ["STUDY/Android"]
category: "STUDY/Android"
source_url: "https://whrdud727.tistory.com/entry/Android-Rooting-in-MAC-OS"
private: false
---

안드로이드에 대한 루팅 방법은 레퍼런스들이 많이 공개되어 있고 정리되어 있다.

대부분 ODIN이라는 친구를 사용한다.

이 친구는 삼성 내부용 플래싱 툴로 알려져 있고, GUI를 지원하기 때문에 손쉽게 다룰 수 있다.

하지만 아쉽게도 윈도우 환경만 지원해주기 때문에... (내가 MAC 용을 못 찾은 건가)

MAC을 사용하기 때문에 ODIN 을 대체할 만한 툴을 찾아보던 중 heimdall을 알게 되었다.

heimdall은 odin의 오픈소스 대체재로 CLI 환경을 제공한다.

* * *

루팅을 진행하기 위해서 크게 3개의 준비 단계가 필요하다.

1\. adb, magisck, heimdall 툴 준비

2\. 실제 Android 폰 준비 - 포맷된 / 미사용중인

3\. 준비한 기종에 맞는 순정 펌웨어 확보

<< 참고로 전 note S5 기종으로 진행했습니다 >>

* * *

```
brew install --cask heimdall-suite
```

먼저 heimdall 을 설치를 진행해준다.

```
system_profiler SPUSBDataType | grep -i -A 10 samsung
```

이제 휴대폰을 연결해서 연결되는지를 한번 확인해준다 (필수는 아닙니다! 확인용 !)

![](/assets/images/tistory/tistory-c0a04e263161/001.png)

여기서 보면 detect까지 수행한 것을 볼 수 있는데 아마 루팅을 처음 하는 사람이라면 여기서 \[ Device detected \] 가 뜨지 않을 것이다.

이유는 heimdall은 odin mode가 활성화 된 기종을 감지하고 연결을 시도하기 때문이라 툴 설치 이후에 폰에서 몇가지 단계를 진행해줘야 한다.

* * *

먼저 휴대폰에서 개발자 모드를 활성화 해준다.

![](/assets/images/tistory/tistory-c0a04e263161/002.png)

이 설정을 진행하고 나면 설정 하단에 \[개발자 옵션\]이 추가된다.

![](/assets/images/tistory/tistory-c0a04e263161/003.png)

OEM과 USB 디버깅 설정을 진행해준 다면 종료한다.

이후 다시 부팅할 때 \[볼륨 줄이기 버튼\] + \[홈 버튼\] + \[전원 버튼\] 3개의 버턴을 동시에 눌려 ODIN MODE가 활성화 된 상태로 부팅을 진행한다.

![](/assets/images/tistory/tistory-c0a04e263161/004.png)

여기까지 진행했으면 heimdall로 detect할 때 잡힐 것이다.

* * *

```
sudo heimdall download-pit --output phone.pit
sudo heimdall print-pit --file phone.pit | egrep -i "Partition Name|BOOT|KERNEL|RECOVERY|VBMETA|INIT_BOOT|APNHLOS"
```

detect된 상태에서 먼저 휴대폰의 데이터를 백업해준다.

루팅을 하는 과정에서 실수하게 되면 벽돌폰이 되기 때문에 혹시라는 상황을 대비하자...

이후에 내부 파티션 이름들을 확인해준다.

어떤 파일을 덮어쓸지나 그런 부분을 확인하기 위함이다.

![](/assets/images/tistory/tistory-c0a04e263161/005.png)

출려된 데이터를 기준으로 보면 해당 기기는 BOOT 파티션이 따로 존재한다.

또한 INIT\_BOOT가 없기 때문에 magisck로 루팅을 하기 위해서는 boot.img를 패치해주면 된다.

[https://samfw.com/firmware/SM-N920S/SKC/N920SKSU2DVG1](https://samfw.com/firmware/SM-N920S/SKC/N920SKSU2DVG1)

이제 이 사이트를 통해 해당 기기의 순정 펌웨어를 확보한다.

![](/assets/images/tistory/tistory-c0a04e263161/006.png)

```
unzip <firmware>
```

이제 압축해제 해주면 되는데 편의상 이름을 변경 후 진행했다.

![](/assets/images/tistory/tistory-c0a04e263161/007.png)

```
cp AP_N920SKSU2DVG1_CL14077807_QB54442049_REV00_user_low_ship_meta.tar.md5 AP.tar
tar -tf AP.tar | egrep -i '(^|/)(boot\.img(\.lz4)?|recovery\.img(\.lz4)?)$'
```

여기서 AP 파일을 확인해주면 내부에 boot.img가 존재하는 것을 알 수 있다.

![](/assets/images/tistory/tistory-c0a04e263161/008.png)

```
tar -xf AP.tar boot.img
```

![](/assets/images/tistory/tistory-c0a04e263161/009.png)

boot.img를 추출해준다.

```
adb push boot.img /sdcard/Download/boot.img
```

이렇게 추출한 boot.img는 이제 magisck를 통해 루팅 준비를 진행할 것이기 때문에 휴대폰으로 옮겨준다.

![](/assets/images/tistory/tistory-c0a04e263161/010.png)

휴대폰에서 magisck를 설치하고 해당 boot.img를 설치해주면 준비 끝!

![](/assets/images/tistory/tistory-c0a04e263161/011.png)

```
adb pull "/sdcard/Download/magisk_patched-30600_nxDQT.img" .
```

패치된 파일 추출해주고 적용하면 끝이다!

추출했으면 다시 재부팅 해주어야 한다. ODIN MODE로!

```
sudo heimdall detect
sudo heimdall flash --pit phone.pit --BOOT magisk_patched-30600_nxDQT.img
```

![](/assets/images/tistory/tistory-c0a04e263161/012.png)

```
adb devices
adb shell su -c id
adb shell su -
```

간단한 명령을 통해 적용된 것을 확인해준다.

바로 이제 공부 시작해볼려 했지만 친구가 루팅된 폰을 빌려가서 일단 에뮬로 공부해야된다...ㅠㅠ
