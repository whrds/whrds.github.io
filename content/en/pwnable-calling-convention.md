---
title: "[PWNABLE] Calling Convention"
description: "Although it is not very important in the current situation where Stack Buffer OverFlow and Return Address OverFlow are in progress, it is one of the most basic parts to understand attack techniques such as rtl, rop, fsb, etc. in future postings. Linux function calling conventions are broadly divided into two types. ("
date: "2023-09-18"
translation_key: "tistory-7be1b58a1192"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention"
private: false
---

Although it is not very important in the current situation where Stack Buffer OverFlow and Return Address OverFlow are in progress, 

This is one of the most basic parts in understanding attack techniques such as rtl, rop, fsb, etc. as we proceed with future postings.

Linux's **function calling conventions** are broadly divided into two types. (It does not mean that there are only two, but that these two types are the basics.)

In the x86 environment, there is a cdecl method that transfers arguments using only the Stack without using registers.

In the x86-64 environment, there is a call protocol called System V that passes arguments using two registers and a stack.

### **x86**

Since there are too few arguments to transmit arguments using registers, the function calling convention using Stack is mainly used.

Depending on the method, there may be **cdecl, fastcall**, etc., but we will cover cdecl, which is the most basic.

Let's check the **cdecl method** by creating a simple example.

```
#include <stdio.h>

void func(int a, int b, int c){
    printf("%d \t %d \t %d", a,b,c);
}

int main(){
    func(9,5,1);
    return 0;
}
```

The above code, when executed, outputs the numbers 9, 5, and 1 in order.

When calling func() from main(), arguments are passed through registers or stack.

Now we will check this process.

Let's debug main() and look at the calling process of func().

![](/assets/images/tistory/tistory-7be1b58a1192/001.png)

Before func(), the values are stored in the order of Stack 1, 5, and 9 through an assembly language called push.

When you check the stack, you can see that the arguments were entered correctly.

![](/assets/images/tistory/tistory-7be1b58a1192/002.png)

Let's also look at it from the perspective of func().

![](/assets/images/tistory/tistory-7be1b58a1192/003.png)

When calling printf(), the value is taken from the Stack.

![](/assets/images/tistory/tistory-7be1b58a1192/004.png)

The checked part is the Stack of func().

If you look at 0xffffd3f0 in the picture above, you can see the Stack Frame of main().

Passing arguments using Stack in this way is the **cdecl function calling convention**.

###x86-64

Unlike x86, the number of registers is sufficient, so registers are used together when passing arguments.

At this time, registers rather than stacks are used first.

I understand that the reason is that, looking at the computer structure, registers are located closer to the CPU than memory.

The calling convention to be discussed here is **SYS V**.

The characteristic is that arguments are passed in the following order:

**rdi => rsi => rdx => rcx => r8 => r9 => stack**

```
#include <stdio.h>

void func(int a, int b, int c, int d, int e, int f, int g){
    printf("%d \t %d \t %d \t %d \t %d \t %d \t %d", a,b,c,d,e,f,g);
}

int main(){
    func(1,2,3,4,5,6,7);
    return 0;
}
```

This code simply outputs 1 to 7.

Let's first look at it by debugging main().

![](/assets/images/tistory/tistory-7be1b58a1192/005.png)

As mentioned earlier, arguments are passed in the following order: rdi, rsi, rdx, rcx, r8, r9, and stack.

![](/assets/images/tistory/tistory-7be1b58a1192/006.png)

This is the register state just before func() is called.

![](/assets/images/tistory/tistory-7be1b58a1192/007.png)

Since there are a total of 7 arguments, you can see that the last argument is in the stack.