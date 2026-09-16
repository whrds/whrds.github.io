---
title: "[AArch64] x86_64 simple comparison"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ This architecture is designed for efficient power use and high performance. It is mainly used in environments such as smartphones and embedded systems. Let’s briefly compare it with x86_64. #include int main(int argc, char*argv[])"
date: "2024-03-20"
translation_key: "tistory-ea29bb13e5df"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-x8664-%EA%B0%84%EB%8B%A8-%EB%B9%84%EA%B5%90"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

It is an architecture designed for efficient power use and high performance.

It is mainly used in environments such as smartphones and embedded systems.

Let’s briefly compare it with x86\_64.

```
#include <stdio.h>

int main(int argc, char*argv[]){
	printf("Hello world!\n");
	return 0;
}
```

Compile the above code in the two ways below.

```
aarch64-linux-gnu-gcc -static -no-pie -o test test.c
```

```
gcc -no-pie -static -o x86 test.c
```

This is a way to check whether it was compiled properly with AArch64.

![](/assets/images/tistory/tistory-ea29bb13e5df/001.png)

You should not try to run or debug the file as is.

This is because there are no AArch64 ld and libc files, but proceed with installation through the path below.

[http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz](http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz) 

```
wget http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz

tar -xvf glibc-2.35-5.1-aarch64.pkg.tar.xz
cd usr/lib/
sudo cp ld-linux-aarch64.so.1 /lib/
sudo cp libc.so.6 /lib/
```

Install gdb-multiarch for AArch64 debugging.

```
sudo apt -y install gdb-multiarch
```

You can debug main() by entering the command as follows.

```
gdb-multiarch
set architecture aarch64
file ./test

disass main
```

![](/assets/images/tistory/tistory-ea29bb13e5df/002.png)

Unfamiliar assembly language and structures are visible.

Let's check this by comparing it with x86\_64.

![](/assets/images/tistory/tistory-ea29bb13e5df/003.png)

You can see that the form of the function's prologue and epilogue has changed from \[push, mov,sub\] -> \[stp, mov\], \[leave-ret\] -> \[ldp-ret\].

In addition, rather than getting the address of the string directly, the relative address is calculated and retrieved through adrp.

This is a summary of each register compared to x86\_64.

```
X0~X7 = rdi, rsi, rdx, rcx, r8 ,r9 와같은 매개 변수 전달
X8~X18 = 임시 레지스터
X19~X28 = 함수를 호출할 때 기존의 메모리 주소를 보존하기 위해 사용되는 백업용 레지스터
X29 = BasePointer
X30 = RetAddress
SP = StackPointer
```