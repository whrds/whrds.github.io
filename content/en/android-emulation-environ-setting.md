---
title: "[Android] Emulation - Environ Setting"
description: "In order to continue studying and broaden my knowledge, I plan to study this as well. (There are so many things I want to study...) I plan to deal with rooting my phone after slowly studying and practicing. In this post, I will cover how to attach the shell and burp suite by emulating through Android Studio."
date: "2026-01-07"
translation_key: "tistory-8e958806759e"
tags: ["STUDY/Android"]
category: "STUDY/Android"
source_url: "https://whrdud727.tistory.com/entry/Android-Emulation-Environ-Setting"
private: false
---

I would like to study this area as well in order to continue studying and expand my knowledge.

(There are so many things I want to study...)

I plan to discuss rooting my phone after slowly studying and practicing.

In this post, we will cover how to emulate and attach a shell and burp suite through Android Studio.

There are some things to install first...

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

Simply install the above and install any additional tools you need in the future.

For reference, since the work environment is MAC, it was performed using brew.

![](/assets/images/tistory/tistory-8e958806759e/001.png)

In the case of jadx, future analysis of Android can be conducted through jadx-gui.

![](/assets/images/tistory/tistory-8e958806759e/002.png)

Emulation can be done through Android Stuido and can be set up through \[Tools -> Device Manager\].

![](/assets/images/tistory/tistory-8e958806759e/003.png)

When emulating, simply select the desired model and proceed.

(In this image, the environment built for the previous CTF problem was taken as is)

```
sudo ln -s /Users/<User ID>/Library/Android/sdk/platform-tools/adb /usr/local/bin/adb
```

In Android Studio, you now access the internal shell through the adb command. 

Therefore, set a symbolic link for convenience.

![](/assets/images/tistory/tistory-8e958806759e/004.png)

```
adb devices
```

If emulation is enabled, you can query the device list through the corresponding command.

![](/assets/images/tistory/tistory-8e958806759e/005.png)

```
adb shell
```

The inner shell is also accessible! 

It is said that Android, like IoT, sometimes analyzes network traffic.

Accordingly, we would like to build an environment that can be analyzed through burp suite.

![](/assets/images/tistory/tistory-8e958806759e/006.png)

First, go to \[proxy -> settings\] in the burp suite and set a port so that all interfaces can access it.

Afterwards, proceed with proxy settings in the emulated mobile phone settings.

![](/assets/images/tistory/tistory-8e958806759e/007.png)

You can set it like this, but if you do this, when you connect to the Internet, you will not be able to access the page normally as shown below.

![](/assets/images/tistory/tistory-8e958806759e/008.png)

This is because it occurs because of the certificate, but since the proxy is currently set to Burp Suite, all you have to do is import the certificate and install it.

```
http://burp
```

![](/assets/images/tistory/tistory-8e958806759e/009.png)

Click \[CA Certificate\] in the upper right corner to proceed with installing the certificate.

Because it is a der extension, change it to a cer extension inside the shell attached to adb.

![](/assets/images/tistory/tistory-8e958806759e/010.png)

Afterwards, proceed with installing the certificate in your phone settings.

![](/assets/images/tistory/tistory-8e958806759e/011.png)

If you proceed to this point, you will be able to analyze internal traffic normally in Burp Suite.

![](/assets/images/tistory/tistory-8e958806759e/012.png)

Now, we plan to study routing and study based on 1-Day and CTF problems!