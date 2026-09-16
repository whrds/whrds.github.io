---
title: "[IPTIME] FIRMWARE ANALYZE #1"
description: "While continuing to analyze 1-DAY vulnerabilities, I became interested in FIRMWARE and decided to proceed with it as a personal project. I am still analyzing it and trying various things, but I will summarize it like this in the meantime. Since I'm just digging in, I think it'll be more about attempts like this rather than explanations or anything like that.N"
date: "2025-02-13"
translation_key: "tistory-46318ff0b3f2"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/IPTIME-FIRMWARE-ANALYZE-1"
private: false
---

While continuing to analyze 1-DAY vulnerabilities, I became interested in FIRMWARE and decided to proceed with it as a personal project.

I'm still analyzing it, trying various things, etc., but I'll organize it like this in the meantime.

Since I'm just digging in, I think it'll be more about attempts like this rather than explanations or anything like that.

![](/assets/images/tistory/tistory-46318ff0b3f2/001.png)

I tried to organize it in NOTION, but I think it would be too long to transfer all the contents here to BrawlG, so I will try to exclude the parts that I skipped as much as possible.

* * *

### TARGET

First, you must select a target.

It is common to select by considering cost, whether FIRMWARE can be extracted, etc.

While wondering what kind of equipment to use, we chose the most commonly used wireless routers, and among them, we decided to use IPTIME, which has FIRMWARE available to the public. 

\[ IPTIME FIRMWARE DOWNLOAD: [https://iptime.com/iptime/?page\_id=126](https://iptime.com/iptime/?page_id=126) \]

Now I have to choose one of the IPTIME models, and I decided to use the AX2004M model that I am using in my room. 

Even though FIRMWARE is open, if emulation fails, you will eventually need equipment. When this situation occurs, I just try to disassemble my router right away.

![](/assets/images/tistory/tistory-46318ff0b3f2/002.png)

IPTIME AX2004M

The price range of the equipment is 80,000 to 100,000 won. 

If I break the FIRMWARE while taking it apart, I can just overwrite it with a normal FIRMWARE, so I proceeded like this.

* * *

### TOOLS

Many tools exist for FIRMWARE analysis.

Representative examples include firmware-analysis-toolkit, FirmAE, and firmadyne, but unfortunately, all other emulating tools have failed.

For this analysis, I used binwalk, which has many good tools, and QEMU for emulation.

* * *

###EXTRACTION

FIRMWARE includes KERNEL IMG, BOOT LOADER, ROOT FILE SYSTEM, and Device Tree.

If you use -e among binwalk's options, you can extract everything right away, but since the main purpose of this project is personal learning, I tried to extract and separate it directly rather than using that option.

If you want to use that option as is, you can use it as follows.

```
binwalk -e [ FIRMWARE ]
```

I won't use the EXPORT option, but I still need to check how the distinction is made, so I used binwalk.

* * *

#### #1 INSTALL FIRMWARE

First, you need to install FIRMWARE for analysis.

![](/assets/images/tistory/tistory-46318ff0b3f2/003.png)

If you go to IPTIME's post, you can download FIRMWARE files.

You can download the file by obtaining the link here and executing the command below.

```
wget https://download.iptime.co.kr/release/15_056/firmware/ax2004m_ml_15_056.bin
```

#### #2 BINWALK 

Now let’s check the configuration of the firmware file.

```
binwalk ax2004m_ml_15_056.bin
```

If you execute the above command, you can see the result as shown below.

![](/assets/images/tistory/tistory-46318ff0b3f2/004.png)

It consists of DTB -> LZMA compressed file -> DTB -> FILESYSTEM.

Before going deeper, I will briefly explain what Device Tree is.

It is mainly used in embedded systems and ARM-based platforms, and is designed so that hardware information and drivers are managed independently. When creating this Device Tree, it is written in a text format called DTS. Each element consists of nodes, properties, registers, compatibility, and interrupts. And the format that compiles this DTS into binary is the format called DTB that is used in that image. This is a structure designed to be read directly by the kernel and can be compiled using the method below.

```
dtc -I dts -O dtb -o project.dtb project.dts
```

If you look at that image again and check, the part compressed with LZMA will contain the kernel image and boot loader, Squashfs will contain rootfs, and DTB will contain definitions and hardware information for each structure.

Now let's extract these parts.

#### #3 SEPARATION

In that image, the four parts separated by binwalk will be divided into part1, part2, part3, part4, and part5.

**PART 1**

The area corresponding to DTB is 56 (0x38) to 284 (0x11c). 

Well, since I don't know what's in 0 (0x0) to 55 (0x37), I'll extract them here first.

```
dd if=./ax2004m_ml_15_056.bin of=./bin1 count=56 bs=1
```

![](/assets/images/tistory/tistory-46318ff0b3f2/005.png)

 After extracting it, there is no need to analyze it... In fact, it seems to be part of the FIRMWARE name.

**PART 2**

```
 dd if=./ax2004m_ml_15_056.bin of=./bin1 count=228 skip=55 bs=1
```

 This part corresponds to the first DTB.

![](/assets/images/tistory/tistory-46318ff0b3f2/006.png)

 It is presumed to be a DTB containing information about the kernel and Linux version. There appears to be no data here, but if you extract it to a different range, you can see a normal DTB file. We will extract and discuss this part together in PART 3.

**PART 3**

 Now, this is a section compressed with LZMA that is presumed to contain information about Kernel img.

```
dd if=ax2004m_ml_15_056.bin of=bin2 bs=1 skip=56 count=3681724
```

![](/assets/images/tistory/tistory-46318ff0b3f2/007.png)

Because it was extracted including PART 2, you can see that the first part is the same.

Now what can you do after extracting?? 

Analyzing with IDA or HEX values...? If it were a regular binary, I would use this method... (horrible...)

Fortunately, DTB files can be converted to DTS. ```
dtc -I dtb -O dts bin2.dtb -o bin2.dts
```

It can be converted in the same way as above. 

![](/assets/images/tistory/tistory-46318ff0b3f2/008.png)

The file is now readable.

However, the capacity is very large because it contains binary as a HEX value inside...

That's why I'm going to split it up and look at it.

```
/dts-v1/;

/ {
	timestamp = <0x67878781>;
	description = "MIPS OpenWrt FIT (Flattened Image Tree)";
	#address-cells = <0x01>;

	images {
```

This is the initial part that defines the FIT image to be used in the MIPS-based OpenWrt system.

FIT img is a multi-image container format used in U-Boot and can include Kernel and Device Tree.

From the above information, you can see that DTS v1 is used and that it is 32 bit through address-cells.

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

 You can see that it is a definition for MIPS Arch-based OpenWrt Kernel IMG.

The Kernel Version is using an older version, linux-4.4.198, and the Kernel IMG can be seen compressed using the LZMA method.

Additional information such as entry points can be identified through metadata such as typs and OS, and hash values ​​for kernel integrity check can be viewed.

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

The fdt@1 node defines the DTB of MIPS-based devices.

Since this node contains the HEX value in uncompressed form, you can view various information about the hardware by extracting and opening it.

Since this part is actual hardware information, I will not define it separately. 

If you want to take a look, click the toggle below... (It is very long, so I recommend not opening it)

See more

/dts-v1/;

/ {

#address-cells = ;

#size-cells = ;

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

#address-cells =  ;

#interrupt-cells = ;

interrupt-controller;

compatible = "mti,cpu-interrupt-controller";

};

aliases {

serial0 = "/palmbus@1e000000/uartlite@c00";

};

cpuclock@0 {

#clock-cells =  ;

compatible = "mtk,mt7621-cpu-clock";

linux,phandle = ;

phandle = ;

};

sysbusclock@0 {

#clock-cells =  ;

compatible = "mtk,mt7621-sys-bus-clock";

linux,phandle = ;

phandle = ;

};

apll@0 {

#clock-cells =  ;

compatible = "fixed-clock";

clock-frequency = <0x1017df80>;

linux,phandle = ;

phandle = ;

};

sysclock50M@0 {

#clock-cells =  ;

compatible = "fixed-clock";

clock-frequency = <0x2faf080>;

linux,phandle = 	;

phandle = 	;

};

sysclock125M@0 {

#clock-cells =  ;

compatible = "fixed-clock";

clock-frequency = <0x7735940>;

linux,phandle = ;

phandle = ;

};

palmbus@1e000000 {

compatible = "palmbus";

reg = <0x1e000000 0x100000>;

ranges = <0x00 0x1e000000 0xfffff>;

#address-cells = ;

#size-cells = ;

sysc@0 {

compatible = "mtk,mt7621-sysc";

reg = <0x00 0x100>;

};

wdt@100 {

compatible = "mtk,mt7621-wdt";

reg = <0x100 0x100>;

};

gpio@600 {

#address-cells = ;

#size-cells =  ;

compatible = "mtk,mt7621-gpio";

reg = <0x600 0x100>;

interrupt-parent = ;

interrupts = <0x00 0x0c 0x04>;

bank@0 {

reg =  ;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = ;

linux,phandle = ;

phandle = ;

};

bank@1 {

reg = ;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = ;

};

bank@2 {

reg = ;

compatible = "mtk,mt7621-gpio-bank";

gpio-controller;

#gpio-cells = ;

};

};

i2c@0 {

compatible = "i2c-gpio";

gpios = <0x02 0x03 0x01 0x02 0x04 0x01>;

i2c-gpio,delay-us = ;

#address-cells = ;

#size-cells =  ;

status = "okay";

pinctrl-names = "default";

pinctrl-0 = ;

};

i2s@a00 {

compatible = "mediatek,mt7621-i2s";

reg = <0xa00 0x100>;

clocks = ;resets = <0x05 0x11>;

reset-names = "i2s";

interrupt-parent = ;

interrupts = <0x00 0x10 0x04>;

txdma-req = ;

rxdma-req = ;

dmas = <0x06 0x04 0x06 0x06>;

dma-names = "tx\\0rx";

status = "disabled";

};

spi@b00 {

status = "okay";

compatible = "mediatek,mt7621-spi";

reg = <0xb00 0x100>;

clocks = ;

resets = <0x05 0x12>;

reset-names = "spi";

#address-cells = ;

#size-cells =  ;

pinctrl-names = "default";

pinctrl-0 = ;

m25p80@0 {

#address-cells = ;

#size-cells = ;

compatible = "jedec,spi-nor";

reg =  ;

spi-max-frequency = <0x989680>;

m25p,chunked-io =  ;

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

clocks = 	;

clock-frequency = <0x2faf080>;

interrupt-parent = ;

interrupts = <0x00 0x1a 0x04>;

reg-shift = ;

reg-io-width = ;

no-loopback-test;

};

uartfull@d00 {

compatible = "mediatek,mt6577-uart\\0ns16550a";

reg = <0xd00 0x100>;

clocks = 	;

clock-frequency = <0x2faf080>;

interrupt-parent = ;

interrupts = <0x00 0x1b 0x04>;

reg-shift = ;

reg-io-width = ;

no-loopback-test;

status = "okay";

};

uartfull@e00 {

compatible = "mediatek,mt6577-uart\\0ns16550a";

reg = <0xe00 0x100>;

clocks = 	;

clock-frequency = <0x2faf080>;

interrupt-parent = ;

interrupts = <0x00 0x1c 0x04>;

reg-shift = ;

reg-io-width = ;

no-loopback-test;

status = "okay";

};

gdma@2800 {

compatible = "mtk,rt3883-gdma";

reg = <0x2800 0x800>;

resets = <0x05 0x0e>;

reset-names = "dma";

interrupt-parent = ;

interrupts = <0x00 0x0d 0x04>;

#dma-cells = ;

#dma-channels = ;

#dma-requests = ;

status = "disabled";

linux,phandle = ;

phandle = ;

};

ecc@3800 {

compatible = "mediatek,mt7621-ecc";

reg = <0x3800 0x800>;

status = "disabled";

linux,phandle = �;

phandle = �;

};

nand@3000 {

compatible = "mediatek,mt7621-nfc";

reg = <0x3000 0x800>;

ecc-engine = �;

#address-cells = ;

#size-cells = ;

pinctrl-names = "default";

pinctrl-0 = �;

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

reset-names="hsdma";

interrupt-parent = ;

interrupts = <0x00 0x0b 0x04>;

#dma-cells = ;

#dma-channels = ;

#dma-requests = ;

status = "disabled";

};

};

rstctrl {

compatible = "ralink,rt2880-reset";

#reset-cells = ;

linux,phandle = ;

phandle = ;

};

clkctrl {

compatible = "ralink,rt2880-clock";

#clock-cells = ;

linux,phandle = ;

phandle = ;

};

ethsys@1e000000 {

compatible = "mediatek,mt7621-ethsys\\0syscon";reg = <0x1e000000 0x8000>;

linux,phandle = �;

phandle = �;

};

raeth@1e100000 {

compatible = "mediatek,mt7621-eth";

reg = <0x1e100000 0xe000>;

interrupt-parent = ;

interrupts = <0x00 0x03 0x04>;

mediatek,ethsys = �;

status = "disabled";

};

ethernet@1e100000 {

compatible = "mediatek,mt7621-eth\\0syscon";

reg = <0x1e100000 0xe000>;

#address-cells = ;

#size-cells =  ;

interrupt-parent = ;

interrupts = <0x00 0x03 0x04>;

mediatek,ethsys = �;

status = "okay";

mac@0 {

compatible = "mediatek,eth-mac";

reg =  ;

phy-mode = "trgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

pause;

};

};

mac@1 {

compatible = "mediatek,eth-mac";

reg = ;

phy-mode = "rgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

pause;

};

};

mdio-bus {

#address-cells = ;

#size-cells =  ;

linux,phandle = �;

phandle = �;

ethernet-phy@1f {

reg = �;

phy-mode = "rgmii";

};

};

};

gsw {

compatible = "mediatek,mt753x";

mt7530,direct-phy-access;

interrupt-parent = ;

interrupts = <0x00 0x17 0x04>;

#address-cells = ;

#size-cells =  ;

mediatek,mdio = �;

mediatek,portmap = "wllll";

mediatek,mcm;

resets = <0x05 0x02>;

reset-names = "mcm";

port@5 {

compatible = "mediatek,mt753x-port";

reg = ;

phy-mode = "rgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

};

};

port@6 {

compatible = "mediatek,mt753x-port";

reg = ;

phy-mode = "trgmii";

fixed-link {

speed = <0x3e8>;

full-duplex;

};

};

mdio-bus {

#address-cells = ;

#size-cells =  ;

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

mtketh-max-gmac = ;

};

sdhci@1e130000 {

status = "okay";

compatible = "mediatek,mt7621-sdhci";

reg = <0x1e130000 0x4000>;

interrupt-parent = ;

interrupts = <0x00 0x14 0x04>;

pinctrl-names = "default";

pinctrl-0 = �;

};

pcie@1e140000 {

compatible = "mediatek,mt7621-pci";

reg = <0x1e140000 0x40000>;

#address-cells = ;

#size-cells = ;

pinctrl-names = "default";

pinctrl-0 = �;

device\_type = "pci";

bus-range = <0x00 0xff>;

ranges = <0x2000000 0x00 0x00 0x60000000 0x00 0x10000000 0x1000000 0x00 0x00 0x1e160000 0x00 0x10000>;

interrupt-parent = ;

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

#address-cells = ;

#size-cells = ;

device\_type = "pci";

};

pcie1 {

reg = <0x800 0x00 0x00 0x00 0x00>;

#address-cells = ;

#size-cells = ;

device\_type = "pci";

};

pcie2 {

reg = <0x1000 0x00 0x00 0x00 0x00>;

#address-cells = ;

#size-cells = ;

device\_type = "pci";

};

};

usb@1e1c0000 {compatible = "mediatek,mt7621-xhci\\0mediatek,mt2701-xhci";

reg = <0x1e1c0000 0x1000 0x1e1d0700 0x100>;

reg-names = "mac\\0ippc";

interrupt-parent = ;

interrupts = <0x00 0x16 0x04>;

clocks = <0x11 0x11 0x11 0x11>;

clock-names = "sys\_ck\\0free\_ck\\0ahb\_ck\\0dma\_ck";

phys = <0x12 0x03 0x13 0x04 0x14 0x03>;

status = "okay";

};

usb-phy@1e1d0000 {

compatible = "mediatek,mt7621-u3phy\\0mediatek,mt2701-u3phy";

#address-cells = ;

#size-cells = ;

ranges;

reg = <0x1e1d0000 0x300>;

status = "okay";

usb-phy@0x1e1d0800 {

reg = <0x1e1d0800 0x100>;

#phy-cells = ;

clocks = ;

clock-names = "ref";

linux,phandle = ;

phandle = ;

};

usb-phy@0x1e1d0900 {

reg = <0x1e1d0900 0x700>;

#phy-cells = ;

clocks = ;

clock-names = "ref";

linux,phandle = ;

phandle = ;

};

usb-phy@0x1e1d1000 {

reg = <0x1e1d1000 0x100>;

#phy-cells = ;

clocks = ;

clock-names = "ref";

linux,phandle = ;

phandle = ;

};

};

interrupt-controller@1fbc0000 {

compatible = "mti,gic";

reg = <0x1fbc0000 0x2000>;

interrupt-controller;

#interrupt-cells = ;

mti,reserved-cpu-vectors = ;

linux,phandle = ;

phandle = ;

timer {

compatible = "mti,gic-timer";

interrupts = <0x01 0x01 0x00>;

clocks = ;

};

};

pinctrl {

compatible = "mtk,mtkmips-pinmux";

pinctrl-names = "default";

pinctrl-0 = ;

pinctrl0 {

linux,phandle = ;

phandle = ;

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

linux,phandle = ;

phandle = ;

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

linux,phandle = �;

phandle = �;

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

linux,phandle = �;

phandle = �;

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

linux,phandle = �;

phandle = �;

sdhci {

mtk,group = "sdhci";

mtk,function = "sdhci";

};

};

spi {

linux,phandle = ;

phandle = ;

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

interrupt-parent = ;

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

This is the settings section for booting.Kernel IMG is defined to use kernel@1, and the device volume is defined to use fdt@1.

* * *

Now that we have confirmed the Kernel IMG data, we can extract and analyze this part.

One problem here is that if you try to decompress the Kernel IMG with LZMA and binarize it, the Kernel IMG is broken. There are some that are not linked to libc files, but if you open them, you can see that there are abnormally few functions. There are many HEX values that are not interpreted properly.

![](/assets/images/tistory/tistory-46318ff0b3f2/009.png)

![](/assets/images/tistory/tistory-46318ff0b3f2/010.png)

These are some of the parts that were not interpreted properly...

![](/assets/images/tistory/tistory-46318ff0b3f2/011.png)

I wrote a code to decompile the binary so that it can be extracted and analyzed using Python's ghidra module, but it cannot be interpreted. Below is the only extracted part.

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

Converting and analyzing DTB files to DTS was the first time I encountered files in this format, so I wanted to analyze them properly. In other words, if your goal is to extract the inside of a file, you can extract it directly from DTB, which is the compiled form of DTS.

![](/assets/images/tistory/tistory-46318ff0b3f2/012.png)

The lzma\_data.dtb file used here is a file that extracts the remaining parts except for 0 to 55 corresponding to PART 1. (While shoveling...)

If you look here, you can see your friend compressed as XZ. You can extract this friend.

```
dd if=./lzma_data.dtb of=dtb/pls bs=1 skip=3801198 count=1120328
```

When extracted using this command, a file with proper linking is extracted.

![](/assets/images/tistory/tistory-46318ff0b3f2/013.png)

![](/assets/images/tistory/tistory-46318ff0b3f2/014.png)

You can see that all functions are normal.

I attempted to use the Kernel environment by using the Kernel IMG as is, but **KERNEL PANNIC!!!!!!!!!!**

#### PART 4

The DTB in the middle happens to be a friend of the hardware DTB seen in PART 3.

(To be exact, while analyzing, I reinstalled binwalk with a different version, and it ended up like this while following my friend.)

Then, we will extract the part located between the DTB and the last squash part.

```
dd if=ax2004m_ml_15_056.bin of=bin3 bs=1 skip=3681780 count=119364
```

![](/assets/images/tistory/tistory-46318ff0b3f2/015.png)

It is just an empty file filled with 0x00 from beginning to end.

#### PART 5

Finally, the final filesystem extraction.

```
 dd if=ax2004m_ml_15_056.bin of=bin4 bs=1 skip=3801144
 unsquashfs bin4
```

Try extracting it via dd and unzipping it via unsquashfs in the same way.

![](/assets/images/tistory/tistory-46318ff0b3f2/016.png)

* * *

First, let's cover this in this post, and then continue in Part 2.