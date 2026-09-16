---
title: "[Android] Rooting in MAC OS"
description: "There are many references published and organized regarding rooting methods for Android. Most people use a friend called ODIN. This friend is known as Samsung's internal flashing tool, and it supports GUI so it is easy to use. But unfortunately, it only supports Windows environment... (Maybe I couldn't find one for MAC) When using MAC"
date: "2026-01-10"
translation_key: "tistory-c0a04e263161"
tags: ["STUDY/Android"]
category: "STUDY/Android"
source_url: "https://whrdud727.tistory.com/entry/Android-Rooting-in-MAC-OS"
private: false
---

There are many references published and organized regarding rooting methods for Android.

Most people use a friend called ODIN.

This friend is known as Samsung's internal flashing tool, and it supports GUI so it is easy to use.

But unfortunately, it only supports Windows environment... (Maybe I couldn't find one for MAC?)

Since I use MAC, I came across heimdall while looking for a tool that could replace ODIN.

heimdall is an open source alternative to odin and provides a CLI environment.

* * *

In order to proceed with rooting, three major preparation steps are required.

1\. Prepare adb, magisck, heimdall tools

2\. Prepare your real Android phone - formatted / unused

3\. Secure genuine firmware suitable for the prepared model

<< For reference, I used the Note S5 model >>

* * *

```
brew install --cask heimdall-suite
```

First, install heimdall.

```
system_profiler SPUSBDataType | grep -i -A 10 samsung
```

Now, connect your mobile phone and check if it is connected (not required! Just for confirmation!)

![](/assets/images/tistory/tistory-c0a04e263161/001.png)

If you look here, you can see that detection has been performed, but if this is your first time rooting, \[ Device detected \] will not appear here.

The reason is that heimdall detects models with odin mode activated and attempts to connect, so you need to perform several steps on your phone after installing the tool.

* * *

First, enable developer mode on your phone.

![](/assets/images/tistory/tistory-c0a04e263161/002.png)

After proceeding with this setting, \[Developer Options\] will be added to the bottom of the settings.

![](/assets/images/tistory/tistory-c0a04e263161/003.png)

If you proceed with OEM and USB debugging settings, it will end.

Afterwards, when rebooting, press three buttons simultaneously: \[Volume down button\] + \[Home button\] + \[Power button\] to proceed with booting with ODIN MODE activated.

![](/assets/images/tistory/tistory-c0a04e263161/004.png)

If you have progressed to this point, it will be caught when detecting with heimdall.

* * *

```
sudo heimdall download-pit --output phone.pit
sudo heimdall print-pit --file phone.pit | egrep -i "Partition Name|BOOT|KERNEL|RECOVERY|VBMETA|INIT_BOOT|APNHLOS"
```

When detected, first back up your phone's data.

If you make a mistake during the rooting process, your phone will be bricked, so be prepared for that situation...

Afterwards, check the internal partition names.

This is to check which files will be overwritten.

![](/assets/images/tistory/tistory-c0a04e263161/005.png)

Based on the released data, the device has a separate BOOT partition.

Also, since there is no INIT\_BOOT, you need to patch boot.img to root with magisck.

[https://samfw.com/firmware/SM-N920S/SKC/N920SKSU2DVG1](https://samfw.com/firmware/SM-N920S/SKC/N920SKSU2DVG1)

Now secure the original firmware for the device through this site.

![](/assets/images/tistory/tistory-c0a04e263161/006.png)

```
unzip <firmware>
```

Now you can unzip it, but for convenience, I changed the name before proceeding.

![](/assets/images/tistory/tistory-c0a04e263161/007.png)

```
cp AP_N920SKSU2DVG1_CL14077807_QB54442049_REV00_user_low_ship_meta.tar.md5 AP.tar
tar -tf AP.tar | egrep -i '(^|/)(boot\.img(\.lz4)?|recovery\.img(\.lz4)?)

If you check the AP file here, you can see that boot.img exists inside.

![](/assets/images/tistory/tistory-c0a04e263161/008.png)

```
tar -xf AP.tar boot.img
```

![](/assets/images/tistory/tistory-c0a04e263161/009.png)

Extract boot.img.

```
adb push boot.img /sdcard/Download/boot.img
```

The boot.img extracted in this way is now transferred to the mobile phone as we will prepare for rooting through magisck.

![](/assets/images/tistory/tistory-c0a04e263161/010.png)

Install magisck on your phone and install the boot.img and you're ready!

![](/assets/images/tistory/tistory-c0a04e263161/011.png)

```
adb pull "/sdcard/Download/magisk_patched-30600_nxDQT.img" .
```

Just extract the patched file and apply it!

Once extracted, you must reboot again. To ODIN MODE!

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

Confirm that it has been applied with a simple command.

I was going to start studying right away, but my friend borrowed a rooted phone, so I had to study with emulator for now...ㅠㅠ
```

If you check the AP file here, you can see that boot.img exists inside.

![](/assets/images/tistory/tistory-c0a04e263161/008.png)

```
tar -xf AP.tar boot.img
```

![](/assets/images/tistory/tistory-c0a04e263161/009.png)

Extract boot.img.

```
adb push boot.img /sdcard/Download/boot.img
```

The boot.img extracted in this way is now transferred to the mobile phone as we will prepare for rooting through magisck.

![](/assets/images/tistory/tistory-c0a04e263161/010.png)

Install magisck on your phone and install the boot.img and you're ready!

![](/assets/images/tistory/tistory-c0a04e263161/011.png)

```
adb pull "/sdcard/Download/magisk_patched-30600_nxDQT.img" .
```

Just extract the patched file and apply it!

Once extracted, you must reboot again. To ODIN MODE!

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

Confirm that it has been applied with a simple command.

I was going to start studying right away, but my friend borrowed a rooted phone, so I had to study with emulator for now...ㅠㅠ