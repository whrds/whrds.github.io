---
title: "[LINUX] Memory structure"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ The memory structure of Linux consists of [CODE segment], [DATA segment], [BSS segment], [HEAP segment], and [STACK segment]. CODE segment This is the area where the code written by the user is stored. The code of the program to be executed is stored."
date: "2023-09-04"
translation_key: "tistory-e863c2da7c8a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0"
private: false
---

**※ If there are any mistakes, please let us know. We will check and correct it. **※**** 

![](/assets/images/tistory/tistory-e863c2da7c8a/001.png)

The memory structure of Linux consists of \[CODE segment\], \[DATA segment\], \[BSS segment\], \[HEAP segment\], and \[STACK segment\].

### **CODE Segment**

This is the area where the code written by the user is stored, and the code of the program to be executed is stored. 

Because the CPU must read and execute this code, it has read and execute permissions.

```
void func1(){ ... }
void func2(){ ... }
int main(){ ... }
```

### **DATA Segment**

This is an area where initialized global variables or static variables are stored, and is allocated at the start of the program and destroyed at the end.

It consists of data that can be read and written and rodata (Read Only Data) that can only be read.

```
int num1 = 1; //data
const int num2 = 2; //rodata

void func1(){
	static int num3 = 3; //data
}
```

### **BSS Segment**

Unlike the DATA segment, this is an area where uninitialized global or static variables are stored. 

```
int num; //bss
const int num2; //rodata

void func1(){
	static int num3 = 3; //bss
}
```

### **STACK Segment**

This is an area where data including local variables and parameters created while a program is running is stored.

Therefore, it has read and write permissions.

A characteristic of STACK is that when its size is expanded, it grows from a high address to a low address. 

```
void func1(){
	int num1;  //stack
	int num2 = 2; //stack
}
```

See more

#### **STACK Frame**

This is the unit used by the STACK segment. A stack frame is created when a function is called and freed when it returns.

![](/assets/images/tistory/tistory-e863c2da7c8a/002.png)

In the picture above, you can see that the stack frame size is created as 0x20.  
(The above example is code that calls func() from main().)

Then, you may think that the total size of the stack frame is 0x20, but in reality, the values of sfp and ret must be included.

In other words, on a 64-bit basis, it has a total size of 0x30, which is buf (0x20 byte) + sfp (0x8 byte) + ret (0x8 byte).

![](/assets/images/tistory/tistory-e863c2da7c8a/003.png)

sfp must contain the rbp value of the previous function, and ret must point to the address to return to when returning.

Let's check whether these values ​​are included.

This is the part that calls func() in main().

![](/assets/images/tistory/tistory-e863c2da7c8a/004.png)

If you think about just the picture above, ret, that is, the address of the function to return to, is call func; The following address, 0x000055555555522c, will be included. Next, I will check sfp as well.

![](/assets/images/tistory/tistory-e863c2da7c8a/005.png)

 Since the sfp in func() is the rbp of main(), you can check the rbp of main(). You can see that the rbp of main() is 0x7fffffffe290 when viewed with gdb.

As seen up to this point, 0x20, the size of the buf variable, should be followed by 0x7fffffffe290, the sfp value, and 0x000055555555522c, the ret value.

This is what rsp looks like in func().

![](/assets/images/tistory/tistory-e863c2da7c8a/006.png)

You can see that 0x7fffffffe260~0x7fffffffe280 is the area of the buf variable, 0x7fffffffe280 is sfp, and 0x7fffffffe288 is ret.

### **HEAP Segment**

This is a space for dynamically allocating memory during program execution. 

This part will be discussed in detail later when writing about ptmalloc.

```
int *num = malloc(1)  //heap

void func1(){
	int *ptr = malloc(8). //heap
}
```