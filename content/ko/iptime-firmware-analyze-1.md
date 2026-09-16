---
title: "[IPTIME] FIRMWARE ANALYZE #1"
description: "계속해서 1-DAY 취약점을 분석하던 중, FIRMWARE에 흥미를 느껴 개인 프로젝트로 진행하게 되었다.아직 계속해서 분석해보고, 여러가지 시도를 해보는 등 삽질을 하고 있지만 중간중간 이렇게 정리하도록 하겠다. 삽질만 하고 있기에.. 설명이나 그런 것이라기 보다는 이런이런 시도를 해보았다는 내용이 더 많을 것 같다.N"
date: "2025-02-13"
translation_key: "tistory-46318ff0b3f2"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/IPTIME-FIRMWARE-ANALYZE-1"
private: false
---

계속해서 1-DAY 취약점을 분석하던 중, FIRMWARE에 흥미를 느껴 개인 프로젝트로 진행하게 되었다.

아직 계속해서 분석해보고, 여러가지 시도를 해보는 등 삽질을 하고 있지만 중간중간 이렇게 정리하도록 하겠다.

삽질만 하고 있기에.. 설명이나 그런 것이라기 보다는 이런이런 시도를 해보았다는 내용이 더 많을 것 같다.

![](/assets/images/tistory/tistory-46318ff0b3f2/001.png)

NOTION에 정리하면서 하긴 했는데 여기 내용을 다 브롤그로 옮기기에는 너무 길어질 것 같기 떄문에 삽질한 부분을 최대한 제외 해보겠다.

* * *

### TARGET

먼저 target 선정을 해야한다.

보통 비용, FIRMWARE 추출 가능한지 여부 등등을 고려하며 선정하는게 일반적이다.

어떤 장비로 해볼까 고민하다가 우리가 가장 흔히 접하는 무선 라우터를 선정하였고, 그 중 FIRMWARE가 공개되어 있는 IPTIME 하기로 했다. 

\[ IPTIME FIRMWARE DOWNLOAD :  [https://iptime.com/iptime/?page\_id=126](https://iptime.com/iptime/?page_id=126) \]

이제 IPTIME 모델 중 하나를 선정해야 하는데 내 자취방에서 사용중인 AX2004M 모델을 사용하기로 했다. 

FIRMWARE가 공개되어 있다고는 해도 에뮬레이팅에 실패하게 된다면 결국은 장비가 필요하다. 이런 상황이 발생했을 때 그냥 내 공유기를 바로 뜯어볼려고 한다.

![](/assets/images/tistory/tistory-46318ff0b3f2/002.png)

IPTIME AX2004M

장비의 가격대는 80,000 ~ 100,000원이다. 

뜯어보다가 FIRMWARE 망가뜨리면 다시 정상정인 FIRMWARE로 덮어씌우면 되기 떄문에 일단 이렇게 진행했다.

* * *

### TOOLS

FIRMWARE 분석을 위해 많은 툴이 존재한다.

대표적으로 firmware-analysis-toolkit,FirmAE, firmadyne 등 존재하는데 다른 에뮬레이팅까지 해주는 툴들은 아쉽게도 다 실패하게 되었다.

이번 분석을 위해 저 좋고 많은 툴들을 두고 binwalk를 사용하고, 에뮬레이팅을 위해 QEMU를 사용했다.

* * *

### EXTRACTION

FIRMWARE에는 KERNEL IMG, BOOT LOADER, ROOT FILE SYSTEM, Device Tree가 존재한다.

binwalk의 옵션 중 -e를 사용하게 되면 바로 다 추출할 수 있지만 이번 프로젝트의 주된 목적은 개인적인 학습이기에 저 옵션을 사용해서가 아닌 직접 뜯어서 분리해보았다.

만약 저 옵션을 그대로 사용하고자 한다면 아래와 같이 사용하면 된다.

```
binwalk -e [ FIRMWARE ]
```

EXPORT하는 옵션은 사용하지 않겠지만 그래도 그 구분은 어떻게 되는지는 확인해야되기에 이건 binwalk를 사용했다.

* * *

#### #1 INSTALL FIRMWARE

먼저 분석할 FIRMWARE을 설치해야 한다.

![](/assets/images/tistory/tistory-46318ff0b3f2/003.png)

IPTIME의 게시글에 들어가보면 FIRMWARE 파일들을 다운 받을 수 있다.

여기서 링크를 얻어 아래 명령을 수행하면 파일을 다운 받을 수 있다.

```
wget https://download.iptime.co.kr/release/15_056/firmware/ax2004m_ml_15_056.bin
```

#### #2 BINWALK 

이제 firmware 파일의 구성을 확인해보겠다.

```
binwalk ax2004m_ml_15_056.bin
```

위 명령을 수행하면 아래와 같이 결과가 뜨는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-46318ff0b3f2/004.png)

DTB -> LZMA로 압축된 파일 -> DTB -> FILESYSTEM으로 구성되고 있다.

더 깊게 들어가기 전에 Device Tree가 무엇인지 간단하게 설명하겠다.

주로 임데디드 시스템과 ARM 기반의 플랫품에서 사용되는 것으로 하드웨어 정보와 드라이버가 독립적으로 관리되도록 설계되어 있다. 이 Device Tree를 작성할때에는 DTS 라고 불리는 텍스트 형식으로 작성한다. 각 요소는 노드, 속성, 레지스터, 호환성, 인터럽트로 구성된다. 그리고 이 DTS를 바이너리로 컴파일한 형식이 저 이미지에 사용되고 있는 DTB라는 형식이다. 이는 커널이 직접 읽을 수 있도록 설계된 구조로 아래 방법으로 컴파일 할 수 있다.

```
dtc -I dts -O dtb -o project.dtb project.dts
```

다시 저 이미지를 보고 확인을 해보자면 LZMA로 압축된 부분은  커널 이미지와 부트로더가 들어있을 것이고, Squashfs는 rootfs, DTB는 각 구조에 대한 정의 및 하드웨어 정보를 포함하고 있을 것이다.

이제 이 부분들을 추출해보겠다.

#### #3 SEPARATION

저 이미지에서 binwalk로 분리된 부분 4개를 각 part1, part2, part3, part4,part5로 구분하겠다.

**PART 1**

DTB에 해당하는 영역은 56(0x38) ~ 284(0x11c)에 해당이 된다. 

그럼 0(0x0) ~ 55(0x37)에는 무엇이 있는지 모르기 때문에 여기를 먼저 추출해보겠다.

```
dd if=./ax2004m_ml_15_056.bin of=./bin1 count=56 bs=1
```

![](/assets/images/tistory/tistory-46318ff0b3f2/005.png)

 추출하고 보니 그냥 분석할 필요도 없는... 사실상 FIRMWARE 이름 같은 부분인 것 같다.

**PART 2**

```
 dd if=./ax2004m_ml_15_056.bin of=./bin1 count=228 skip=55 bs=1
```

 이 부분이 첫 DTB에 해당하는 부분이다.

![](/assets/images/tistory/tistory-46318ff0b3f2/006.png)

 Kernel 및 리눅스 버젼에 대한 정보를 포함하고 있는 DTB로 추정이 된다. 여기서는 데이터가 없어보이는데 범위를 다르게 해서 추출하면 정상적인 DTB 파일을 볼 수 있다. 이에 대해서는 PART3에서 이 부분을 같이 추출해서 다루겠다.

**PART 3**

 이제 Kernel img에 대한 정보를 가지고 있을 것으로 추정되는 LZMA로 압축된 구간이다.

```
dd if=ax2004m_ml_15_056.bin of=bin2 bs=1 skip=56 count=3681724
```

![](/assets/images/tistory/tistory-46318ff0b3f2/007.png)

PART 2이 부분을 포함하여 추출하였기에 앞 부분은 동일한 것을 볼 수 있다.

이제 추출한 다음에 무엇을 할 수 있는가?? 

IDA나 HEX 값으로 분석...? 일반적인 바이너리였다면 이런 방법을 사용하겠다만... (끔찍..)

다행히 DTB 파일은 DTS로 전환할 수 있다고 한다. 

```
dtc -I dtb -O dts bin2.dtb -o bin2.dts
```

위와 같은 방법으로 변환할 수 있다. 

![](/assets/images/tistory/tistory-46318ff0b3f2/008.png)

이제 파일을 읽을 수 있게 되었다.

근데 내부에 HEX 값으로 바이너리를 포함하기에 매우 용량이 크다...

떄문에 분할해서 살표보겠다.

```
/dts-v1/;

/ {
	timestamp = <0x67878781>;
	description = "MIPS OpenWrt FIT (Flattened Image Tree)";
	#address-cells = <0x01>;

	images {
```

MIPS 기반 OpenWrt 시스템에서 사용될 FIT 이미지를 정의하는 초반 부분이다.

FIT img는 U-Boot에서 사용되는 멀티 이미지 컨테이너 형식으로 Kernel과 Device Tree 등을 포함할 수 있다.

위 정보를 통해 DTS v1을 사용하고, address-cells을 통해 32 bit 라는 것을 알 수 있다.

```
		kernel@1 {
			description = "MIPS OpenWrt Linux-4.4.198";
			data = [6d 00 00 80 00 60 21 d4 00 00 00 00 00 00 00 6f fd ff ff a3 b7 7f ca 77 9a 1d cd 71 7d c6 32 0d 6c 11 9f 5d 7a 60 33 d1 10 30 85 45 05 51 af 18 fb 4a 36 d8 92 f3 8e 83 57 2b 2e 8e 46 9f cb bb c7 92 e5 41 a6 cd 85 b8 05 e6 3e eb fe 61 13 d3 6f d5 08 ae c3 95 68 e0 68 7f d8 a6 7d c2 75 af 74 81 d5 ae ca d6 64 6a b0 c8 78 7e 4a 9f d9 15 db 3f 9f 57 83 53 4f 75 b6 16 52 7a 3c fd 53 b7 da 42 36 9c a5 4b 59 c1 56 a3 f7 71 48 ce 07 4c 4c 80 7f a3 74 73 de a9 aa fb 56 22 8c 14 ed f1 66 c4 cc 25 26 51 22 1e 5c 7b 96 f7 e2 1e 6c 35 c6 0e 3c c8 7e 57 2c 6d 89 9d 99 1a fb 8e ba 21 5a c1 0c 0b da 38 b4 39 14 af 47 18 09 45 4e f5 37 12 8e b5 63 b3 6e aa ca 8b 88 ca 60 c0 22 75 ab 43 0c 4a 56 d5 96 77 ce 49 cb 8
			.....d1 bf 1e 2b 35 76 23 b6 47 69 74 33 c3 8b 92 37 9a a2 4a 89 43 20 37 a8 e7];
			type = "kernel";
			arch = "mips";
			os = "linux";
			compression = "lzma";
			load = <0x81001000>;
			entry = <0x81001000>;

			hash@1 {
				value = <0xaba1133f>;
				algo = "crc32";
			};

			hash@2 {
				value = <0x51d184a5 0x57da018 0x41d4fd33 0x9ff9fb9f 0xef30b7be>;
				algo = "sha1";
			};
		};
```

 MIPS Arch 기반 OpenWrt Kernel IMG에 대한 정의인 것을 볼 수 있다.

Kernel Version은 linux-4.4.198로 오래된 버젼을 사용하고 있고, Kernel IMG는 LZMA 방식으로 압축된 것을 볼 수 있다.

typs, os 등 메타데이터를 통해 엔트리 포인트 같은 추가적인 정보를 파악할 수 있으며 커널 무결성 검사를 위한 hash 값들을 볼 수 있다.

```
		fdt@1 {
			description = "MIPS OpenWrt mt7621-rfb-ax-nor-ax2004 device tree blob";
			data = [d0 0d fe ed 00 00 29 d9 00 00 00 38 00 00 26 d4 00 00 00 28 00 00 00 11 00 00 00 10 00 00 00 00 00 00 03 
			......73 00];
			type = "flat_dt";
			arch = "mips";
			compression = "none";

			hash@1 {
				value = <0x21bcc955>;
				algo = "crc32";
			};

			hash@2 {
				value = <0x3cce5e0a 0x4888ce27 0xc8ae2d72 0xc48a8523 0xf43b7316>;
				algo = "sha1";
			};
		};
	};
```

fdt@1 노드는 MIPS 기반 기기의 DTB를 정의하고 있다.

이 노드는 압축되지 않은 형태로 HEX 값을 그대로 포함하고 있기에 이를 추출하여 뜯어보면 하드웨어의 각종 정보를 살펴볼 수 있다.

이 부분은 진짜 하드웨어 정보이기에 따로 정의를 해두진 않겠다. 

살펴보실 분은 아래 토글을... (매우 길기 떄문에 안 열어보는 것을 추천)

더보기

/dts-v1/;

/ {

#address-cells = <0x01>;

#size-cells = <0x01>;

compatible = "mediatek,mt7621-rfb-nor-ax2004\\0mediatek,mt7621-soc";

model = "MediaTek MT7621 RFB (802.11ax,SNOR)";

cpus {

cpu@0 {

compatible = "mips,mips1004Kc";

};

cpu@1 {

compatible = "mips,mips1004Kc";

};

};

cpuintc@0 {

#address-cells = <0x00>;

#interrupt-cells = <0x01>;

interrupt-controller;

compatible = "mti,cpu-interrupt-controller";

};

aliases {

serial0 = "/palmbus@1e000000/uartlite@c00";

};

cpuclock@0 {

#clock-cells = <0x00>;

compatible = "mtk,mt7621-cpu-clock";

linux,phandle = <0x15>;

phandle = <0x15>;

};

sysbusclock@0 {

#clock-cells = <0x00>;

compatible = "mtk,mt7621-sys-bus-clock";

linux,phandle = <0x07>;

phandle = <0x07>;

};

apll@0 {

#clock-cells = <0x00>;

compatible = "fixed-clock";

clock-frequency = <0x1017df80>;

linux,phandle = <0x04>;

phandle = <0x04>;

};

sysclock50M@0 {

#clock-cells = <0x00>;

compatible = "fixed-clock";

clock-frequency = <0x2faf080>;

linux,phandle = <0x09>;

phandle = <0x09>;

};

sysclock125M@0 {

#clock-cells = <0x00>;

compatible = "fixed-clock";

clock-frequency = <0x7735940>;

linux,phandle = <0x11>;

phandle = <0x11>;

};

palmbus@1e000000 {

compatible = "palmbus";

reg = <0x1e000000 0x100000>;

ranges = <0x00 0x1e000000 0xfffff>;

#address-cells = <0x01>;

#size-cells = <0x01>;

sysc@0 {

compatible = "mtk,mt7621-sysc";

reg = <0x00 0x100>;

};

wdt@100 {

compatible = "mtk,mt7621-wdt";

reg = <0x100 0x100>;

};

gpio@600 {

#address-cells = <0x01>;

#size-cells = <0x00>;

compatible = "mtk,mt7621-gpio";

reg = <0x600 0x100>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x0c 0x04>;

bank@0 {

reg = <0x00>;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = <0x02>;

linux,phandle = <0x02>;

phandle = <0x02>;

};

bank@1 {

reg = <0x01>;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = <0x02>;

};

bank@2 {

reg = <0x02>;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = <0x02>;

};

};

i2c@0 {

compatible = "i2c-gpio";

gpios = <0x02 0x03 0x01 0x02 0x04 0x01>;

i2c-gpio,delay-us = <0x03>;

#address-cells = <0x01>;

#size-cells = <0x00>;

status = "okay";

pinctrl-names = "default";

pinctrl-0 = <0x03>;

};

i2s@a00 {

compatible = "mediatek,mt7621-i2s";

reg = <0xa00 0x100>;

clocks = <0x04>;

resets = <0x05 0x11>;

reset-names = "i2s";

interrupt-parent = <0x01>;

interrupts = <0x00 0x10 0x04>;

txdma-req = <0x02>;

rxdma-req = <0x03>;

dmas = <0x06 0x04 0x06 0x06>;

dma-names = "tx\\0rx";

status = "disabled";

};

spi@b00 {

status = "okay";

compatible = "mediatek,mt7621-spi";

reg = <0xb00 0x100>;

clocks = <0x07>;

resets = <0x05 0x12>;

reset-names = "spi";

#address-cells = <0x01>;

#size-cells = <0x00>;

pinctrl-names = "default";

pinctrl-0 = <0x08>;

m25p80@0 {

#address-cells = <0x01>;

#size-cells = <0x01>;

compatible = "jedec,spi-nor";

reg = <0x00>;

spi-max-frequency = <0x989680>;

m25p,chunked-io = <0x20>;

partition@0 {

label = "Bootloader";

reg = <0x00 0x40000>;

};

partition@40000 {

label = "Config";

reg = <0x40000 0x10000>;

};

partition@50000 {

label = "Factory";

reg = <0x50000 0x40000>;

};

partition@90000 {

label = "firmware";

reg = <0x90000 0xf00000>;

};

partition@f90000 {

label = "rootfs\_data";

reg = <0xf90000 0x70000>;

};

};

};

uartlite@c00 {

compatible = "mediatek,mt6577-uart\\0ns16550a";

reg = <0xc00 0x100>;

clocks = <0x09>;

clock-frequency = <0x2faf080>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x1a 0x04>;

reg-shift = <0x02>;

reg-io-width = <0x04>;

no-loopback-test;

};

uartfull@d00 {

compatible = "mediatek,mt6577-uart\\0ns16550a";

reg = <0xd00 0x100>;

clocks = <0x09>;

clock-frequency = <0x2faf080>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x1b 0x04>;

reg-shift = <0x02>;

reg-io-width = <0x04>;

no-loopback-test;

status = "okay";

};

uartfull@e00 {

compatible = "mediatek,mt6577-uart\\0ns16550a";

reg = <0xe00 0x100>;

clocks = <0x09>;

clock-frequency = <0x2faf080>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x1c 0x04>;

reg-shift = <0x02>;

reg-io-width = <0x04>;

no-loopback-test;

status = "okay";

};

gdma@2800 {

compatible = "mtk,rt3883-gdma";

reg = <0x2800 0x800>;

resets = <0x05 0x0e>;

reset-names = "dma";

interrupt-parent = <0x01>;

interrupts = <0x00 0x0d 0x04>;

#dma-cells = <0x01>;

#dma-channels = <0x10>;

#dma-requests = <0x10>;

status = "disabled";

linux,phandle = <0x06>;

phandle = <0x06>;

};

ecc@3800 {

compatible = "mediatek,mt7621-ecc";

reg = <0x3800 0x800>;

status = "disabled";

linux,phandle = <0x0a>;

phandle = <0x0a>;

};

nand@3000 {

compatible = "mediatek,mt7621-nfc";

reg = <0x3000 0x800>;

ecc-engine = <0x0a>;

#address-cells = <0x01>;

#size-cells = <0x01>;

pinctrl-names = "default";

pinctrl-0 = <0x0b>;

status = "disabled";

};

memc@5000 {

compatible = "mtk,mt7621-memc";

reg = <0x5000 0x1000>;

};

hsdma@7000 {

compatible = "mediatek,mt7621-hsdma";

reg = <0x7000 0x1000>;

resets = <0x05 0x05>;

reset-names = "hsdma";

interrupt-parent = <0x01>;

interrupts = <0x00 0x0b 0x04>;

#dma-cells = <0x01>;

#dma-channels = <0x01>;

#dma-requests = <0x01>;

status = "disabled";

};

};

rstctrl {

compatible = "ralink,rt2880-reset";

#reset-cells = <0x01>;

linux,phandle = <0x05>;

phandle = <0x05>;

};

clkctrl {

compatible = "ralink,rt2880-clock";

#clock-cells = <0x01>;

linux,phandle = <0x10>;

phandle = <0x10>;

};

ethsys@1e000000 {

compatible = "mediatek,mt7621-ethsys\\0syscon";

reg = <0x1e000000 0x8000>;

linux,phandle = <0x0c>;

phandle = <0x0c>;

};

raeth@1e100000 {

compatible = "mediatek,mt7621-eth";

reg = <0x1e100000 0xe000>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x03 0x04>;

mediatek,ethsys = <0x0c>;

status = "disabled";

};

ethernet@1e100000 {

compatible = "mediatek,mt7621-eth\\0syscon";

reg = <0x1e100000 0xe000>;

#address-cells = <0x01>;

#size-cells = <0x00>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x03 0x04>;

mediatek,ethsys = <0x0c>;

status = "okay";

mac@0 {

compatible = "mediatek,eth-mac";

reg = <0x00>;

phy-mode = "trgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

pause;

};

};

mac@1 {

compatible = "mediatek,eth-mac";

reg = <0x01>;

phy-mode = "rgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

pause;

};

};

mdio-bus {

#address-cells = <0x01>;

#size-cells = <0x00>;

linux,phandle = <0x0d>;

phandle = <0x0d>;

ethernet-phy@1f {

reg = <0x1f>;

phy-mode = "rgmii";

};

};

};

gsw {

compatible = "mediatek,mt753x";

mt7530,direct-phy-access;

interrupt-parent = <0x01>;

interrupts = <0x00 0x17 0x04>;

#address-cells = <0x01>;

#size-cells = <0x00>;

mediatek,mdio = <0x0d>;

mediatek,portmap = "wllll";

mediatek,mcm;

resets = <0x05 0x02>;

reset-names = "mcm";

port@5 {

compatible = "mediatek,mt753x-port";

reg = <0x05>;

phy-mode = "rgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

};

};

port@6 {

compatible = "mediatek,mt753x-port";

reg = <0x06>;

phy-mode = "trgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

};

};

mdio-bus {

#address-cells = <0x01>;

#size-cells = <0x00>;

};

};

hnat@1e100000 {

compatible = "mediatek,mtk-hnat\_v1";

reg = <0x1e100000 0x3000>;

resets = <0x0c 0x00>;

reset-names = "mtketh";

status = "okay";

mtketh-wan = "eth1";

mtketh-ppd = "eth0";

ext-devices = "rax0\\0ra0\\0rax1\\0ra1\\0rax2\\0ra2\\0rax3\\0ra3\\0apclix0\\0apcli0";

mtketh-max-gmac = <0x02>;

};

sdhci@1e130000 {

status = "okay";

compatible = "mediatek,mt7621-sdhci";

reg = <0x1e130000 0x4000>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x14 0x04>;

pinctrl-names = "default";

pinctrl-0 = <0x0e>;

};

pcie@1e140000 {

compatible = "mediatek,mt7621-pci";

reg = <0x1e140000 0x40000>;

#address-cells = <0x03>;

#size-cells = <0x02>;

pinctrl-names = "default";

pinctrl-0 = <0x0f>;

device\_type = "pci";

bus-range = <0x00 0xff>;

ranges = <0x2000000 0x00 0x00 0x60000000 0x00 0x10000000 0x1000000 0x00 0x00 0x1e160000 0x00 0x10000>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x04 0x04 0x00 0x18 0x04 0x00 0x19 0x04>;

status = "okay";

resets = <0x05 0x18 0x05 0x19 0x05 0x1a>;

reset-names = "pcie0\\0pcie1\\0pcie2";

clocks = <0x10 0x18 0x10 0x19 0x10 0x1a>;

clock-names = "pcie0\\0pcie1\\0pcie2";

reset-gpios = <0x02 0x13 0x01>;

reset-gpio-names = "pcie";

pcie0 {

reg = <0x00 0x00 0x00 0x00 0x00>;

#address-cells = <0x03>;

#size-cells = <0x02>;

device\_type = "pci";

};

pcie1 {

reg = <0x800 0x00 0x00 0x00 0x00>;

#address-cells = <0x03>;

#size-cells = <0x02>;

device\_type = "pci";

};

pcie2 {

reg = <0x1000 0x00 0x00 0x00 0x00>;

#address-cells = <0x03>;

#size-cells = <0x02>;

device\_type = "pci";

};

};

usb@1e1c0000 {

compatible = "mediatek,mt7621-xhci\\0mediatek,mt2701-xhci";

reg = <0x1e1c0000 0x1000 0x1e1d0700 0x100>;

reg-names = "mac\\0ippc";

interrupt-parent = <0x01>;

interrupts = <0x00 0x16 0x04>;

clocks = <0x11 0x11 0x11 0x11>;

clock-names = "sys\_ck\\0free\_ck\\0ahb\_ck\\0dma\_ck";

phys = <0x12 0x03 0x13 0x04 0x14 0x03>;

status = "okay";

};

usb-phy@1e1d0000 {

compatible = "mediatek,mt7621-u3phy\\0mediatek,mt2701-u3phy";

#address-cells = <0x01>;

#size-cells = <0x01>;

ranges;

reg = <0x1e1d0000 0x300>;

status = "okay";

usb-phy@0x1e1d0800 {

reg = <0x1e1d0800 0x100>;

#phy-cells = <0x01>;

clocks = <0x11>;

clock-names = "ref";

linux,phandle = <0x12>;

phandle = <0x12>;

};

usb-phy@0x1e1d0900 {

reg = <0x1e1d0900 0x700>;

#phy-cells = <0x01>;

clocks = <0x11>;

clock-names = "ref";

linux,phandle = <0x13>;

phandle = <0x13>;

};

usb-phy@0x1e1d1000 {

reg = <0x1e1d1000 0x100>;

#phy-cells = <0x01>;

clocks = <0x11>;

clock-names = "ref";

linux,phandle = <0x14>;

phandle = <0x14>;

};

};

interrupt-controller@1fbc0000 {

compatible = "mti,gic";

reg = <0x1fbc0000 0x2000>;

interrupt-controller;

#interrupt-cells = <0x03>;

mti,reserved-cpu-vectors = <0x07>;

linux,phandle = <0x01>;

phandle = <0x01>;

timer {

compatible = "mti,gic-timer";

interrupts = <0x01 0x01 0x00>;

clocks = <0x15>;

};

};

pinctrl {

compatible = "mtk,mtkmips-pinmux";

pinctrl-names = "default";

pinctrl-0 = <0x16>;

pinctrl0 {

linux,phandle = <0x16>;

phandle = <0x16>;

gpio {

mtk,group = "i2c";

mtk,function = "gpio";

};

uart2 {

mtk,group = "uart2";

mtk,function = "uart2";

};

uart3 {

mtk,group = "uart3";

mtk,function = "uart3";

};

jtag {

mtk,group = "jtag";

mtk,function = "gpio";

};

wdt {

mtk,group = "wdt";

mtk,function = "gpio";

};

sdhci {

mtk,group = "sdhci";

mtk,function = "gpio";

};

};

i2c {

linux,phandle = <0x03>;

phandle = <0x03>;

i2c {

mtk,group = "i2c";

mtk,function = "gpio";

};

};

mdio {

mdio {

mtk,group = "mdio";

mtk,function = "mdio";

};

};

nand {

linux,phandle = <0x0b>;

phandle = <0x0b>;

spi-nand {

mtk,group = "spi";

mtk,function = "nand1";

};

sdhci-nand {

mtk,group = "sdhci";

mtk,function = "nand2";

};

};

pcie {

linux,phandle = <0x0f>;

phandle = <0x0f>;

pcie {

mtk,group = "pcie";

mtk,function = "gpio";

};

};

rgmii1 {

rgmii1 {

mtk,group = "rgmii1";

mtk,function = "rgmii1";

};

};

rgmii2 {

rgmii2 {

mtk,group = "rgmii2";

mtk,function = "rgmii2";

};

};

sdhci {

linux,phandle = <0x0e>;

phandle = <0x0e>;

sdhci {

mtk,group = "sdhci";

mtk,function = "sdhci";

};

};

spi {

linux,phandle = <0x08>;

phandle = <0x08>;

spi {

mtk,group = "spi";

mtk,function = "spi";

};

};

uart1 {

uart1 {

mtk,group = "uart1";

mtk,function = "uart1";

};

};

uart2 {

uart2 {

mtk,group = "uart2";

mtk,function = "uart2";

};

};

uart3 {

uart3 {

mtk,group = "uart3";

mtk,function = "uart3";

};

};

};

crypto@1e004000 {

status = "okay";

compatible = "mediatek,mtk-eip93";

reg = <0x1e004000 0x1000>;

interrupt-parent = <0x01>;

interrupts = <0x00 0x13 0x04>;

};

chosen {

bootargs = "console=ttyS0,115200";

};

};

```
	configurations {
		default = "config@1";

		config@1 {
			description = "OpenWrt";
			kernel = "kernel@1";
			fdt = "fdt@1";
		};
	};
};
```

부팅을 위한 설정 부분이다.

Kernel IMG는 kernel@1을 사용하고, 디바이스 볼륨은 fdt@1을 사용하도록 정의한다.

* * *

자 이제 Kernel IMG의 데이터를 확인했으니 이 부분을 추출해서 분석할 수 있게 되었다.

여기서 문제가 하나 있다고 하면 Kernel IMG를 LZMA로 압축 풀고 바이너리화 하는 식으로 시도를 하게 될 경우 Kernel IMG가 깨져있다. libc 파일들이랑 링킹이 되어 있지 않은 것도 있지만 뜯어보면 함수가 비정상적으로 적은 것을 볼 수 있다. 제대로 해석되지 않은 HEX 값들은 많고..

![](/assets/images/tistory/tistory-46318ff0b3f2/009.png)

![](/assets/images/tistory/tistory-46318ff0b3f2/010.png)

이 부분들이 제대로 해석되지 않은 부분의 일부인데....

![](/assets/images/tistory/tistory-46318ff0b3f2/011.png)

바이너리를 python의 ghidra 모듈을 사용하여 추출 및 분석 가능하게 디컴파일 해주는 코드를 작성해보았지만 해석이 되질 않는다.. 아래는 유일하게 추출된 부분이다..

```
whrd@whrdser:~/Desktop/study/capstone/iptime_firm$ cat output.txt
Decompiled Functions:

/* Function: entry */

/* WARNING: Control flow encountered bad instruction data */

void processEntry entry(void)

{
  syscall(0);
  syscall(0);
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}
```

DTB 파일을 DTS로 변환하고 분석한 것은 처음 접해보는 형식의 파일들이기 때문에 제대로 뜯어보고자 한 것이다. 다시 말해 파일 내부를 추출하는 것이 목적이라면 DTS가 컴파일된 형태인 DTB 에서 바로 추출하면 된다.

![](/assets/images/tistory/tistory-46318ff0b3f2/012.png)

여기서 사용된 lzma\_data.dtb 파일은 PART 1에 해당하는 0~55를 제외한 나머지 부분을 추출한 파일이다. (삽질 하던 중..)

여기서 보면 XZ로 압축된 친구를 볼 수 있는데 이 친구를 추출하면 된다.

```
dd if=./lzma_data.dtb of=dtb/pls bs=1 skip=3801198 count=1120328
```

이 명령을 통해 추출하면 링킹도 제대로 된 상태의 파일이 하나 추출된다.

![](/assets/images/tistory/tistory-46318ff0b3f2/013.png)

![](/assets/images/tistory/tistory-46318ff0b3f2/014.png)

함수들도 다 정상적으로 있는 것을 볼 수 있다.

해당 Kernel IMG를 그대로 사용하여 Kernel 환경을 사용하고자 시도했지만 **KERNEL PANNIC!!!!!!!!!**

#### PART 4

중간에 껴있던 DTB는 어쩌다보니 PART 3에서 본 하드웨어 DTB 친구이다.

( 정확히는 분석하던 중 binwalk를 다른 버젼으로 재설치 했는데 그 친구 따라하다가 이리 되었다.)

그럼 그 DTB와 마지막 squash 부분 중간에 위치한 부분을 추출해보겠다.

```
dd if=ax2004m_ml_15_056.bin of=bin3 bs=1 skip=3681780 count=119364
```

![](/assets/images/tistory/tistory-46318ff0b3f2/015.png)

그냥 처음부터 끝까지 0x00으로 채워진 빈 파일이다.

#### PART 5

드디어 마지막 filesystem 추출이다.

```
 dd if=ax2004m_ml_15_056.bin of=bin4 bs=1 skip=3801144
 unsquashfs bin4
```

동일한 방식으로 dd를 통해 추출을 시도하고 unsquashfs을 통해 압축을 해제한다.

![](/assets/images/tistory/tistory-46318ff0b3f2/016.png)

* * *

우선 해당 게시글에서는 여기까지 다뤄보고, 이후는 2편에서 이어서 작성을..
