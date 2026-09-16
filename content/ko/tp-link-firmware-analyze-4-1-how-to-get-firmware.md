---
title: "[TP-LINK] FIRMWARE ANALYZE #4 - #1. How To Get FIRMWARE"
description: "보통 회사에서 프로젝트를 진행하게 되면 하나 끝나고 바로 이어서 다른 프로젝트가 진행된다. 첫 프로젝트에서는 새로운 기술들을 많이 배울 수 있었으며, 기존에 가지고 있던 분석 능력을 포함한 기술 능력들을 향상할 수 있었다. 때문에 다음 프로젝트에서도 무엇을 더 배우고 성장할 수 있을지 기대하고 있었는데...텀이 생겨버렸다"
date: "2025-08-28"
translation_key: "tistory-27d29bcca2fa"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-%EA%B0%9C%EC%9D%B8-%EA%B3%B5%EB%B6%80-%EC%A4%91-%EB%B6%84%EC%84%9D%EC%9D%B4-%EB%81%9D%EB%82%9C-%EC%9D%B4%ED%9B%84-%EA%B3%B5%EA%B0%9C%EB%A1%9C-%EC%A0%84%ED%99%98-%EC%98%88%EC%A0%95"
private: false
---

보통 회사에서 프로젝트를 진행하게 되면 하나 끝나고 바로 이어서 다른 프로젝트가 진행된다.  
   
첫 프로젝트에서는 새로운 기술들을 많이 배울 수 있었으며, 기존에 가지고 있던 분석 능력을 포함한 기술 능력들을 향상할 수 있었다. 때문에 다음 프로젝트에서도 무엇을 더 배우고 성장할 수 있을지 기대하고 있었는데...  
텀이 생겨버렸다.   
   
덕분에 여유 시간이 생겼지만 이 시간을 기회로 삼아 새로 배웠던 기술들을 내 걸로 만들고, 더 나아가 직접 분석하며 연구해 보는 것을 목표로 선정하였다.  
   
이제 분기 마다 1개 이상의 IoT 장비를 타겟으로 하여 분석을 시도해 나갈 예정이다.   
 

* * *

## TARGET

언제나처럼 어떤 타겟을 대상으로 하면 좋을지 고민을 많이 해봤다.   
   
새로운 타겟을 잡아볼까, 아니면 기존에 진행해 본 경험이 있는 모델류를 다시 해볼까  
   
최종 선정은 한번 더 무선 라우터로 하였다.  
이유는 단순하다. 평소 공부할 때 관심 있는 분야이면 기본기부터 천천히 쌓아나가며 내 기술로 만드는 것을 좋아한다.  
기존에 팀 및 개인 단위 프로젝트로 무선 라우터를 3차례 정도 뜯어본 경험이 있으나 다 성공적인 결과를 내지 못하였으며 장비를 직접 구비해서 진행한 경험은 1번에 불과하기 때문에 이번에는 무조건 취약점을 찾아보겠다는 목표와 하드웨어 해킹 기술들과 취약점 탐지/분석 기술들을 지금보다 더 발전시켜 보겠다는 목표를 가지고 선정하게 되었다.  
이번 프로젝트 이후로는 기존에 뜯어두었던 TAPO IPCAM을 다시 잡아볼 예정이다.  
   
무선 라우터에도 제조사에 따라 펌웨어 구성 방식이 달라진다.  
iptime, tplink, asus 등 다양한데, 일단 국내 제조사가 아닌 곳을 기준으로 삼았다.  
   
백도어 및 1-day case 들을 분석해 보다가 tplink 무선 라우터를 대상으로 하기로 선정하였다.   
여기서도 어떤 모델을 하느냐에 따라 달라지는데 이왕이면 많은 수요가 있는 장비 중 비교적 가격대가 높지 않은 것을 하고 싶었다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/001.jpg)

\[TPLINK ARI R5\]

   
기존에 출시되었던 다른 모델들과 디자인이 다르며, 공간 차지도 적고 어디에나 설치할 수 있다는 장점이 보여 TPLINK AIR R5 모델을 선정하게 되었다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/002.png)

   
가격대는.......  
미래를 위한 투자라는 생각으로 크게 지불했다....  
   
장비를 최대한 손상 안되게 뜯었으며 내부 펌웨어를 추출하고 취약점 검증 용으로만 사용할 것이기 때문에, 프로젝트가 끝나면 싸게 처리를 해봐야겠다. 생각 있는 분 연락...  
 

* * *

## FIRMWARE-ONLINE

[https://www.tp-link.com/kr/support/download/archer-air-r5/](https://www.tp-link.com/kr/support/download/archer-air-r5/) 

 [다운로드 함 Archer Air R5 | TP-Link 대한민국

TP Link - Download Center Detail

www.tp-link.com](https://www.tp-link.com/kr/support/download/archer-air-r5/)

![](/assets/images/tistory/tistory-27d29bcca2fa/003.png)

   
일단 TP-LINK도 iptime처럼 인터넷에 펌웨어 파일을 올려둔다.  
암호화해 가지고....  
   
[https://github.com/watchfulip/tp-link-decrypt](https://github.com/watchfulip/tp-link-decrypt)

 [GitHub - watchfulip/tp-link-decrypt: Decrypt TP-Link Firmware

Decrypt TP-Link Firmware. Contribute to watchfulip/tp-link-decrypt development by creating an account on GitHub.

github.com](https://github.com/watchfulip/tp-link-decrypt)

다행히 github에 복호화 스크립트가 올라와 있다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/004.png)

복호화 과정은 여기선 스킵. 이후에 하드웨어에서 펌웨어 추출 및 rfs까지 하는 것을 설명하겠다.  
   
이렇게 추출된 펌웨어 파일에서 우선 1차 분석을 수행하였다.  
아쉽게도 html, lua 파일들은 여기에 존재하지 않아 웹 기반 분석은 uhttpd로 분석을 수행하였다.  
일부 파일에 대해서는 uhttpd 내부 로직으로 웹 파일이 구성되는 것으로 보인다.  
   
이전 게시글에서 펌웨어 분석을 위해서는 /etc/rc.d 경로를 보라고 했었다. 

![](/assets/images/tistory/tistory-27d29bcca2fa/005.png)

이번엔 좀 뭐가 많다..  
   
이런 경우에는 이 친구들을 순차적으로 실행시켜 주는 스크립트를 먼저 찾아준다.

![](/assets/images/tistory/tistory-27d29bcca2fa/006.png)

   
/etc/inittab, /etc/init.d/rcS 스크립트를 중심으로 분석을 시작하면 된다.  
   
분석하다 보면 아래오 같은 코드가 있는데 이 부분이 /etc/rc.d/에 위치한 스크립트들을 실행시켜 주는 친구들이다.

```
if [ "$1" = "S" -a "$foreground" != "1" ]; then
        run_scripts "$1" "$2" &
else
        run_scripts "$1" "$2"
fi
```

   
   
   
   
 

* * *

## FIRMWARE-HARDWARE

자 이번엔 하드웨어 장비에서 추출하여 분석을 시도해 보겠다.  
하드웨어 해킹 기술을 배우고 기술을 제대로 익히고자 장비를 결국 구비했다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/007.png)

장비가 오자마자 바로 분해했다. 나사로 고정된 형식이 아닌 끼워 바깥과 안쪽에 흠이 있어 끼워 맞추는 형식의 제품이다.  
덕분에 저 뚜껑 여는데만 시간이 좀 걸렸다.  
   
보드 상태를 보면 은색 판들이 보이는데 모두 떼어낼 수 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/008.png)

   
   
이제 UART만 찾으면 되는데 집에 있던 멀티테스터기가 제대로 측정을 못하여 회사로 가져가서 진행했다.  
 

#### UART

UART는 하드웨어 기반의 통신 규약 중 하나로, 대표적인 직렬 통신 프로토콜이다.  
병렬과는 달리 데이터를 한 비트씩 순차적으로 받는 구조이기 때문에 쉽게 안정적인 데이터 송수신이 가능하다.  
   
임베디드 장비에서는 커널 메시지, 디버그 로그, 부팅 로그 등 다양한 정보를 얻을 수 있으며 일부 장비에 대해서는 바로 쉘을 취득할 수도 있다.  
   
이 UART라는 친구를 가지고 펌웨어를 획득하거나 커맨드 쉘에 접근이 가능해진다.  
물론 대상 장비만 있어야 하는 게 아닌 USB to Serial... 등 연결 커넥터와 점퍼 케이블이 필요하다.  
   
UART는 총 4개의 핀을 사용한다.

-   TX : 데이터 송신
-   RX : 데이터 수신
-   GND : 그라운드
-   VCC : 전압

찾는 방법은 간단하다. 

![](/assets/images/tistory/tistory-27d29bcca2fa/009.png)

먼저 멀티테스터기를 연속성 테스트 모드(부저)로 설정해 준다. 보통 스피커 모양으로 표시되어 있는 경우가 많다.  
이 상태에서 빨간색, 검은색 리드선을 보드에 가져다 데다 보면 울리는 부분이 있는 게, 그곳이 GND이다.  
보통 리드선 하나는 금속 실드 케이스나 포트 외각 등에 연결한다고 하는데 나는 플래시 메모리의 핀을 더 많이 이용하는 편이다.

![](/assets/images/tistory/tistory-27d29bcca2fa/010.png)

어떤 플래시 메모리가 부착되어 있느냐에 따라서 위치는 달라질 수 있다.   
위 그림은 ESMT 플래시 메모리 중 하나에 대한 데이터 시트이다. (현 타겟 장비의 플래시 메모리가 아닙니다. 그냥 예시로 저 이미지 가져왔습니다.)  
데이터 시트를 보면 8핀 중 하나인 VSS가 GND 핀인 것을 알 수 있기 때문에 확정적인 GND 하나를 알 수 있게 된다.   
이후 다른 리드선을 여기저기 가져다 데다 울리면 거기도 GND인 것이다.  
   
나머지 RX, TX, VCC를 찾을 때는 보드에 전원을 켜주어야 한다.  
전원을 연결한 상태에서 검정 리드선은 GND에 연결하고 빨간 리드선을 움직이면서 찾아야 한다.  
   
이때는 멀티테스터기를 연속성 테스트 모드(부저)가 아닌 전압 측정으로 바꿔주고 진행해줘야 한다.

![](/assets/images/tistory/tistory-27d29bcca2fa/011.png)

-   RX : 약 0.0
-   TX : 약 1.8
-   VCC : 약 3.3  또는 5.5

![](/assets/images/tistory/tistory-27d29bcca2fa/012.png)

해당 PCB 같은 경우에는 UART 부분이 바로 보이지만 그렇지 않은 친구들이 많다.  
이런 애들은 진짜 노가다로 하나씩 모든 핀을 연결해봐야 한다...  
   
이렇게 다 찾았으면 이제 본격적인 연결을 해줘야 한다.  
GND <-> GND  
RX <-> TX  
TX <-> RX  
VCC - X  
연결 이후에 전원을 연결해 부팅을 할 것이기 때문에 VCC는 연결할 필요가 없다.  
RX는 데이터 수신을 담당하기 때문에 송신하는 TX와 교차로 연결을 해주어야 한다. 마찬가지로 TX도 RX와 연결해 주면 된다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/013.png)

   
   
이후 터미널을 준비해 준다.  
윈도우면 Putty 같은 터미널들을 준비해 주면 되는데 나는 맥북 유저라... 터미널을 열어준다.  
   
/dev/ 경로를 보면 연결된 장비들에 대한 정보를 볼 수 있다.  
이때 저 USB to Serial을 연결을 했다면 아래처럼 \[tty.usbserial-0001\] 이 뜬 것을 볼 수 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/014.png)

   
저 이름을 그대로 복사하여 아래와 같이 작성해 주면 되는데 이때 baudrate를 알아내야 한다.

```
screen /dev/tty.usbserial-0001 [baudrate]
```

전용 장비가 있긴 하지만 그것까지 굳이 구비할 필요가 없다.  
[https://lucidar.me/en/serialib/most-used-baud-rates-table/](https://lucidar.me/en/serialib/most-used-baud-rates-table/)

 [Most common baud rates table | Lulu's blog

<!-- Accordez-moi une faveur , prenez quelques instants pour découvrir mon dernier projet . Merci, Lulu --> Most common baud rates table The following table shows the most used baud rates. The left side part of the table shows speed and bit duration. The

lucidar.me](https://lucidar.me/en/serialib/most-used-baud-rates-table/)

이런 사이트를 보면 자주 사용되는 친구들이 정리되어 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/015.png)

   
보통 115200 값을 많이 사용하는 걸로 알고 있는데 그렇지 않은 경우도 있다.  
   
일단 잘못된 baudrate를 입력하면 아래처럼 우리가 읽을 수 없는 문자들이 뜬다.

![](/assets/images/tistory/tistory-27d29bcca2fa/016.png)

   
저 출력되는 결과를 보면서 하나씩 입력해 보면 정상적인 baudrate를 찾을 수 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/017.png)

   
   
자 이제 UART까지 정상 연결했는데 이제 뭘 할 수 있나...  
이렇게 연결을 하고 접속하면 바로 login 메시지가 뜨면서 커맨드 쉘이 열리는 경우가 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/018.png)

아쉽게도 이 TP-LINK 라우터는 그렇지 않았다.. 입력이 막혀있..  
대기 상태... 이 라우터의 경우 웹이 Lua로 동작한다. 때문에 관련 신호가 올 때까지 저러고 대기 상태를 유지한다.  
   
이러면 다른 방법을 사용해 펌웨어를 얻어내야 한다.  
방법은 크게 3가지가 있다.  
 

#### Serial Data Output Faul Injection

부팅되는 과정에서 펌웨어가 실행되는 단계가 있다.   
이때 interrupt를 발생시키게 되면 부트로더 쉘이 실행되는데 이 방식을 통해 펌웨어를 얻는 방법이 있다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/019.png)

장비마다 Interrupt 발생 키는 다르겠지만 이 장비의 경우 Enter 키였다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/020.png)

help 명령을 입력한 결과인데 일반적인 부트 방식이 아닌 메모리 주소를 가지고 실행하는 그런 구조인 것으로 보인다.  
또한 부팅 관련 환경변수나 그런 것도 설정이 되어 있지 않아 일반적으로 많이 사용하는 방식인 환경변수에 쉘이나 텔넷 등을 넣어 부팅 시에 실행되게 하는 방식은 불가하다.  
   
가장 알려진 방법이 안되는 상황이지만 아직 방법 2가지가 남아있다.  
하나는 USB를 활용하는 방법인데 해당 PCB 판을 보면 포트가 없기 때문에 불가하다.  
   
그럼 마지막 남은 방법인 네트워크를 활용하면 된다.  
부트로더 쉘을 보면 tftpput를 지원하고 있다.  
tftpput는 TFTP(Trivial File Transfer Protocol)을 이용해 로컬 장치에서 원격 TFTP 서버로 파일을 업로드 할 수 있는 명령이다.  
   
해당 명령을 활용하여 펌웨어 이미지를 DUMP 뜬 다음에 전송하면 된다.  
먼저 setenv 명령으로 환경 변수를 설정해준다.

![](/assets/images/tistory/tistory-27d29bcca2fa/021.png)

```
setenv ipaddr = 172.16.10.2 #라우터
setenv serverip = 172.16.10.67 #개인 PC
setenv gatewayip = 172.16.10.2 #라우터와 동일
setenv netmask = 255.255.255.0
```

처음에는 당연히 192.168.0.XXX 대역이겠지 했는데 막상 연결해보니 다른 대역이었다..  
   
라우터 쪽에서는 준비가 끝났으니 이제 터미널 쪽에서 TFTP 서버를 열어준다. 이때 파일 수신이 가능하게 열어줘야 한다.  
   
위와 같이 설정해준 다음에 아래 명령을 통해 DUMP 뜨고 송신해준다.  
메모리 offset은 smeminfo 명령을 통해 확인할 수 있다.

![](/assets/images/tistory/tistory-27d29bcca2fa/022.png)

```
nand read 0x44000000 0x0 0x4000000
tftpput 0x44000000 0x4000000 nand_full.bin
```

![](/assets/images/tistory/tistory-27d29bcca2fa/023.png)

이렇게 died로 뜬다면 TFTP 서버 쪽에서 설정이 잘못되어 있다는 것이다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/024.png)

설정을 잘 해주었다면 이렇게 뜨면서 파일이 펌웨어가 송수신 된 것을 볼 수 있다.  
   
이 장비의 플래시 메모리는 NAND 칩이다.   
때문에 OOB를 포하한 bad block 이 많이 있을 것이라 추측했지만, 메모리에 적제되어 있던 친구를 그대로 DUMP 뜨고 옮겨온 거라 정상적인 펌웨어 파일이 추출되었다.  
 

![](/assets/images/tistory/tistory-27d29bcca2fa/025.png)

```
dd if=nand_full.bin of=ubi_A.ubi bs=1 skip=$((0x640000)) count=$((0x2A00000))
dd if=nand_full.bin of=ubi_B.ubi bs=1 skip=$((0x30A0000)) count=$((0x2A00000))

ubireader_extract_images ubi_A.ubi 

cd ubi_A.ubi/
unsquashfs  img-794303425_vol-ubi_rootfs.ubifs
```

잘 추출된 것을 볼 수 있다.  
   
만약 이 방법이 안되었다면 Glitching Attack을 수행해야 한다.  
위에 있는 그림 중 데이터 시트 그림이 있는데 이때 SO 핀이 있는 것을 볼 수 있다.  
   
Glitching Attack 공격은 이 SO 핀과 GND를 부팅되는 중간에 연결하여 강제로 부트로더 쉘이 실행되게 하는 방법이다.  
관련해서는 해당 타겟 장비가 아닌 TAPO C200 모델을 대상으로 진행했다.

![](/assets/images/tistory/tistory-27d29bcca2fa/026.png)

카메라 장비이다 보니 보드가 조그만하다.   
오른쪽에 UART 처럼 보이는 구간이 존재하지만 저기에는 GND, VCC만 존재하니... 저 작은 핀을 하나씩 집어가며 찾아야 한다.

![](/assets/images/tistory/tistory-27d29bcca2fa/027.png)

   
핀이 진짜 작기 때문에 PCBite로 연결해주었다.

UART로 보이는 단자가 있긴 하지만 중간에 연결이 끊어져 있다. 

때문에 납땜을 하거나 하여 이어주는 작업이 필요한데 회사에 PCBite라는 좋은 친구가 있기 때문에 바로 이용해주었다.

  
UART 연결 후 접속하면 바로 login 입력 커맨드 쉘이 뜨긴 하는데 비밀번호를 모르기 때문에 부트로더 쉘을 활용했다.

![](/assets/images/tistory/tistory-27d29bcca2fa/028.png)

플래시 메모리의 데이터 시트를 찾아 SO/DO를 찾아야 한다.  
   
 

![](/assets/images/tistory/tistory-27d29bcca2fa/029.png)

왼쪽 2번째 위치에 DO가 있는 것을 볼 수 있다.  
이제 전원 연결 후 해당 핀과 GND를 접촉시키면 부트로더 쉘이 아래와 같이 실행된다. (바로 Help 명령을 입력한 모습이다.)

![](/assets/images/tistory/tistory-27d29bcca2fa/030.png)

   
이전에 진행했었던 네트워크를 활용하는 방법은 관련 명령이 없기 때문에 불가능해보인다.

![](/assets/images/tistory/tistory-27d29bcca2fa/031.png)

이런 경우는 환경 변수를 조작하여 진행한다는데...  PCB 판이 갑자기 죽어버려서 추가 진행은 하지 못했다.  
장비 재구매 들어가자...   
   
다른 방법은 이제 flashrom을 활용해야 한다. 이를 위해서는 PCBite 라는 고가의 장비가 필요하기 때문에 집에서 개인적으로 하기에는 어려움이 있다.  
또한 라즈베리 파이가 필요하다.

![](/assets/images/tistory/tistory-27d29bcca2fa/032.png)

라즈베리 파이의 핀에는 각 역할이 존재하는데 이 역할 구성과 데이터 시트를 참고하여 핀을 연결해주어야 한다.

![](/assets/images/tistory/tistory-27d29bcca2fa/033.png)

플래시 메모리마다 차이는 있을 수 있지만 이런식으로 연결하면 된다.  
   
마지막 방법은 그냥 플래시 메모리를 직접 떼어내어 직접 읽어들이는 방법이다.  
   
이 2가지 방법까지 가지 않아도 충분히 펌웨어를 구할 수 있는 환경이 되었기에 해당 내용에 대해서는 작업을 진행할 때 추가로 작성하겠다.

* * *

## Analyze #1

먼저 분석해주어야 하는 친구는 /etc/inittab -> /etc/init.d/rcS -> /etc/rc.d/\* 이다.

![](/assets/images/tistory/tistory-27d29bcca2fa/034.png)

부팅할 때에 /etc/init.d/rcS를 S 인자를 주고 실행하고 있다.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org

. /lib/functions.sh

run_scripts_K() {
	timeout_reboot_f &
	for i in /etc/rc.d/$1*; do
		config_load sysmode
		config_get initlist sysmode initial
		find=0
		fname=`echo $i | sed 's/\/etc\/rc\.d\/K[0-9]*//g'`
		for j in $initlist; do
			[ "$j" = "$fname" ] && {
				let find=1
				break
			}
		done
		[ $find = 0 -a -x $i ] && $i $2 2>&1
	done | $LOGGER
}

run_scripts() {
	for i in /etc/rc.d/$1*; do
		config_load sysmode
		config_get initlist sysmode initial
		find=0
		fname=`echo $i | sed 's/\/etc\/rc\.d\/S[0-9]*//g'`
		for j in $initlist; do
			[ "$j" = "$fname" ] && {
				let find=1
				break
			}
		done
		[ $find = 0 -a -x $i ] && $i $2 2>&1
	done | $LOGGER
}

system_config() {
	config_get_bool foreground $1 foreground 0
}

LOGGER="cat"
[ -x /usr/bin/logger ] && LOGGER="logger -s -p 6 -t sysinit"

config_load system
config_foreach system_config system

if [ "$1" = "S" -a "$foreground" != "1" ]; then
	run_scripts "$1" "$2" &
elif [ "$1" = "K" ]; then
	run_scripts_K "$1" "$2"
else
	run_scripts "$1" "$2"
fi
```

이 스크립트는 부팅하는 과정에서 /etc/rc.d/에 위치한 S로 시작하는 스크립트들의 실행을 담당한다.

그리고 시스템 종료할 때에 K로 시작하는 스크립트들을 실행시켜 종료하는 역할을 한다.

![](/assets/images/tistory/tistory-27d29bcca2fa/035.png)

부팅/종료 간의 초기 설정에 대한 스크립트들이다.

(대부분의 스크립트들은 /etc/init.d/ 경로로 링크가 걸려있다.)

여기서 원래의 장비라면 failsafe mode라는 것이 존재한다.

들어가는 방법은 전원 연결 후 reset 버턴을 몇 초 누르면 된다.

보통 이 모드에 들어가게 되면 telnetd 관련 서비스가 실행되기 때문에 관련 동작을 찾아보았다.

```
	ln -sf /tmp/resolv.conf.auto /tmp/resolv.conf
	grep -q debugfs /proc/filesystems && mount -t debugfs debugfs /sys/kernel/debug
	[ "$FAILSAFE" = "true" ] && touch /tmp/.failsafe
	[ -d  /storage ] && mount -t jffs2 mtd:storage /storage
	[ -d  /data ] && mount -t jffs2 mtd:data /data
	# mount_tpdata move to /lib/preinit
```

이 부분은 /etc/init.d/boot을 추정하면 실행 여부를 확인할 수 있다.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org
# Copyright (C) 2010 Vertical Communications

export PATH=/bin:/sbin:/usr/bin:/usr/sbin

pi_ifname=
pi_ip=192.168.1.1
pi_broadcast=192.168.1.255
pi_netmask=255.255.255.0

fs_failsafe_ifname=
fs_failsafe_ip=192.168.1.1
fs_failsafe_broadcast=192.168.1.255
fs_failsafe_netmask=255.255.255.0

fs_failsafe_wait_timeout=2

pi_suppress_stderr="y"
pi_init_suppress_stderr="y"
pi_init_path="/bin:/sbin:/usr/bin:/usr/sbin"
pi_init_cmd="/sbin/init"

. /lib/functions.sh
. /lib/functions/boot.sh

boot_hook_init preinit_essential
boot_hook_init preinit_main
boot_hook_init failsafe
boot_hook_init initramfs
boot_hook_init preinit_mount_root

for pi_source_file in /lib/preinit/*; do
    . $pi_source_file
done

boot_run_hook preinit_essential

pi_mount_skip_next=false
pi_jffs2_mount_success=false
pi_failsafe_net_message=false

boot_run_hook preinit_main
```

/etc/preinit을 살펴보면 failsafe 모드로 진입할 때의 기본 네트워크 설정 값을 볼 수. ㅣㅆ다.

```
#!/bin/sh
# Copyright (C) 2006 OpenWrt.org
# Copyright (C) 2010 Vertical Communications

failsafe_netlogin () {
    telnetd -l /bin/login.sh <> /dev/null 2>&1
}

failsafe_shell() {
    lock /tmp/.failsafe
    ash --login
    echo "Please reboot system when done with failsafe network logins"
}

boot_hook_add failsafe failsafe_netlogin
boot_hook_add failsafe failsafe_shell
```

lib/preinit/99\_10\_failsafe\_login 을 보면 failsafe 모드에서 Telnetd를 실행하는 것을 볼 수 있다.

```
...
	return $keypressed
}

failsafe_wait() {
    FAILSAFE=
    pi_failsafe_net_message=true
    preinit_net_echo "Please press button now to enter failsafe"
    pi_failsafe_net_message=false
    fs_wait_for_key f 'to enter failsafe mode' $fs_failsafe_wait_timeout && FAILSAFE=true && export FAILSAFE
}

#boot_hook_add preinit_main failsafe_wait
```

99\_10\_failsafe\_login 을 추적해보면 이제 실제 telnetd 실행 함수가 호출 되는지 확인 가능하다.

해당 Target 장비에서는 주석처리 되어 있는 것을 통해 사용하지 않는 것을 볼 수 있다.
