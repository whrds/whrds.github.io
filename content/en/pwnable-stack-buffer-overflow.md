---
title: "[PWNABLE]Stack Buffer OverFlow"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ Buffer OverFlow is divided into Stack Buffer OverFlow and Heap Buffer OverFlow depending on the area in which it occurs. Since the Heap will be discussed next, only Stack Buffer OverFlow will be written."
date: "2023-09-06"
translation_key: "tistory-bc8b2be0d67f"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLEStack-Buffer-OverFlow"
private: false
---

**※ If there are any mistakes, please let me know. We will make corrections after confirmation.** **※**   
   
**Buffer OverFlow** is divided into Stack Buffer OverFlow and Heap Buffer OverFlow depending on the area in which it occurs.  
Since we will cover the Heap later, we will only write about Stack Buffer OverFlow.  
   
First, you need to know the concept of Buffer.  
A buffer is used by a computer to process data. Simply put, it is a temporary storage of data.   
For example, there is a way to transmit and receive data called 12345. The receiving side processes the data as soon as it is received, but if there is no temporary storage, the received data will be lost during processing.   
In other words, a situation arises where only data 123 is received, not data 12345.  
   
This **Buffer** is used as a storage for local variables or parameters in the Stack.  
When there are variables A and B, in the high-level language we use, the two variables are defined separately, so you may think that the Buffer also exists in a different space.  
Now let's check this perspective from a computer's perspective. When programs running on a computer use the Stack, they utilize continuous memory space. Therefore, even if we define different variables, if they are in the same area, the buffers of the variables are continuously attached.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/001.png)

* * *

### **Stack Buffer OverFlow Example**

```
#include <stdio.h>

int main(){
	char name[10]="Whrd";
	char buf[0x50];
	
	printf("Hello! %s!!\n",name);
	printf("Where are you from?\n");
	read(0,buf,0x100);
	
	printf("Bye! %s\n",name);

	return 0;
}
```

The above code simply has the function of greeting the user and asking where they are from.  
  
If you look at the code, you may have noticed it to some extent, but there is a BOF vulnerability in the code.

```
char name[10]="Whrd";
char buf[0x50];
read(0,buf,0x100);
```

The size of the string called buf is 0x50, but you can see that 0x100 is input using read().  
In this previous post, I briefly wrote about Stack Frame.  
[(](https://whrdud727.tistory.com/category/STUDY/PWNABLE)[https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)](https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)

 [\[LINUX\] Memory Structure

※ If there are any mistakes, please let us know. We will check and correct it. ※ The memory structure of Linux consists of \[CODE segment\], \[DATA segment\], \[BSS segment\], \[HEAP segment\], and \[STACK segment\].

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0)

Stack Frame also has local variables and parameters, but also has sfp, which stores the rbp of the previous function, and ret, which is the return address.  
   
If you overwrite ret, it will result in Return Address OverFlow, but I will slowly write the stack first.  
In the above code, our goal is to change 'Whrd' contained in the string named name to another string.  
In order to overwrite, you must first check the location of the variables on the Stack.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/002.png)

First of all, if you look at the allocated size, it is 0x60.  
   
You can find each variable by looking at the stack, but when functions such as printf(), read(), etc. are called, each variable is used as an argument.  
Using this point, you can easily find out the location of variables.

![](/assets/images/tistory/tistory-bc8b2be0d67f/003.png)

The arguments to printf() are the name variable and the string “Hello! % s!!”   
If you look at the above assembly language code, you can see that the name string is \[rbp-0xa\] because printf(\[rip+0 xe66\], \[rbp-0xa\].  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/004.png)

If you look at read() in the same way, you can see that \[rbp-0x60\] is buf.  
Looking at the code, you might think that \[rbp-0x60\] is the third argument because it was called first, but if you look closely at the code, you will see that \[rbp-0x60\] is called into the rax register and is passed as the second argument.   
In other words, buf, which was the second argument of read(), is \[rbp-0x60\].  
   
Here's a table of what we've found out so far:

buf \[rbp-0x60\]

dummy \[rbp-0x50\]

name \[rbp-0xa\]

sfp

ret

   
As mentioned earlier, our goal is to overwrite the name string, so an attack will be possible by entering a dummy as large as 0x56 and entering the value you want to modify in the name.  
   
Before attacking, let's take a look at the state of the stack.

![](/assets/images/tistory/tistory-bc8b2be0d67f/005.png)

It would be nice if you could find the name right away just by looking at the picture above, but some people may not be familiar with it yet.  
Therefore, we will look at the part corresponding to the name string separately.

![](/assets/images/tistory/tistory-bc8b2be0d67f/006.png)

The name contains 0x64726857, which is the value of 'Whrd' converted to ASCII.  
   
Now let's attack.  
This is a payload code that sequentially inputs a dummy of 0x56 and the string to be modulated.  
 

```
from pwn import *

p = process('./bof')

payload = b'A'*0x56
payload += b'NB_hacker'

p.send(payload)

p.interactive()
```

   
After executing the above code, we will take a look at the stack.  
 

![](/assets/images/tistory/tistory-bc8b2be0d67f/007.png)

You can see that the values are different from the Stack you saw earlier. 0x41 is 'A'.   
In other words, it contains the value (payload) we entered in read().  
   
I will also check the name string.

![](/assets/images/tistory/tistory-bc8b2be0d67f/008.png)

The above value is 'NB\_hacker' entered in payload.  
 ![](/assets/images/tistory/tistory-bc8b2be0d67f/009.png)

If you look at the part covered by the box, you can see that the string is normally passed as an argument.  
   
The final result looks like this:

![](/assets/images/tistory/tistory-bc8b2be0d67f/010.png)