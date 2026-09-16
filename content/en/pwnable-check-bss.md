---
title: "[PWNABLE] Check .bss"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ When discussing memory structure, I explained that the bss segment is the area where uninitialized variables are stored. Since we will be covering various techniques in the future, this segment is important. To find the location of the bss segment, you can use the readelf command. reade"
date: "2023-11-07"
translation_key: "tistory-3e7f3a390222"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-bss-%ED%99%95%EC%9D%B8%ED%95%98%EA%B8%B0"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※** 

When discussing memory structure, I explained that the bss segment is the area where uninitialized variables are stored.

This segment is important as we will be discussing various techniques in the future.

To find the location of the bss segment, you can use the readelf command.

```
readelf -S [파일명]
```

![](/assets/images/tistory/tistory-3e7f3a390222/001.png)

By checking the mapped areas, you can confirm that the bss area exists.

![](/assets/images/tistory/tistory-3e7f3a390222/002.png)

You can see that the address of the bss segment is 0x404040.

The reason why the bss segment is important is that it is a writable area.

Looking at the permissions, it is WA, and you can check the table below.

![](/assets/images/tistory/tistory-3e7f3a390222/003.png)

The reason why readability is important is that if you place a string such as "/bin/sh" in this area and use it, it can be used for attacks.