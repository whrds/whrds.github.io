---
title: "[PWNABLE] Finding Gadget"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ In previous RTL, the explanation for \"gadget\" is as follows: 2023.10.22 - [STUDY/PWNABLE] - [PWNABLE] RTL generally refers to a \"code snippet.\" At first glance, this might sound confusing. A ret gadget"
date: "2023-11-07"
translation_key: "tistory-b1bf11c8e44d"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Gadget-%EC%B0%BE%EA%B8%B0"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※** 

In the previous RTL, the explanation for what a gadget is as follows:

[2023.10.22 - [STUDY/PWNABLE] - [PWNABLE] RTL](https://whrdud727.tistory.com/22)

> Generally, it refers to a "code snippet."  
> At first glance, this might sound confusing.  
>   
> I will explain using the example of a ret gadget.  
> A ret gadget is literally a code snippet used to execute the ret instruction.  
>   
> When you disassemble, you will see code such as pop rdi, rsi, ret, etc.  
> This part is referred to as a code snippet, i.e., a "gadget."

Now, I will discuss how to find these gadgets.

Among the methods for finding gadgets, ROPgadget is the most representative.

```
sudo pip3 install ropgadget
```

By entering the above command, you can install it. (You need to have pip3 installed beforehand.)

![](/assets/images/tistory/tistory-b1bf11c8e44d/001.png)

This message appears because it is already installed. However, in the case of the first installation, it will run normally.

The usage is simple.

You just need to declare that you want to analyze the binary file with an option.

```
ROPgadget --binary [파일명]
```

![](/assets/images/tistory/tistory-b1bf11c8e44d/002.png)

When you execute the command, you will see many gadgets.

Among these gadgets, you will see a familiar pop | rdi gadget.

![](/assets/images/tistory/tistory-b1bf11c8e44d/003.png)

You can confirm that there are gadgets for modifying rdi and rsi.

It is important to note that the presence of gadgets may vary depending on the binary file.

To view only the desired parts, you can use 'grep'.

```
ROPgadget --binary [파일명] | grep [찾을 가젯]
```

![](/assets/images/tistory/tistory-b1bf11c8e44d/004.png)