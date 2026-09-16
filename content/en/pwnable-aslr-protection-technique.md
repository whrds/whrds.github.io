---
title: "[PWNABLE] ASLR Protection Technique"
description: "※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections. ※ This is a protection technique that randomly changes the addresses of the stack, heap, and shared library areas every time the binary is executed, excluding the code area. You can see that the addresses change every time it is executed. This is the code of the above executable file. #include #include #include cha"
date: "2023-10-22"
translation_key: "tistory-82c31cff9454"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ASLR-%EB%B3%B4%ED%98%B8%EA%B8%B0%EB%B2%95"
private: false
---

**※ If there are any incorrect parts, please let me know. I will check and make the necessary corrections.** **※** 

This is a protection technique that randomly changes the addresses of the stack, heap, and shared library areas, excluding the code area, every time the binary is executed.

![](/assets/images/tistory/tistory-82c31cff9454/001.png)

You can see that the addresses change every time it is executed.

This is the code of the above executable file.

```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
 
char *global = "whrd";
  
int main(){
    char *heap = malloc(100);
    char *stack[] = {"whrd"};
 
    printf("[Heap]  address: %p\n", heap);
    printf("[Stack] address: %p\n", stack);
    printf("[libc]  address: %p\n",**(&stack + 3));
    printf("[.data] address: %p\n",global);
    gets(heap);
    return 0;
}
```

Currently, ASLR is applied.

```
 cat /proc/sys/kernel/randomize_va_space
```

You can check this using the above command.

![](/assets/images/tistory/tistory-82c31cff9454/002.png)

There are three possible states for the application of ASLR: 0, 1, and 2.

**First, the state with 0 applied** is shown below.

![](/assets/images/tistory/tistory-82c31cff9454/003.png)

You can see that the address areas do not change.

**The state with 1 applied** is shown below.

![](/assets/images/tistory/tistory-82c31cff9454/004.png)

Only the stack and libc areas change.

**The state with the default value 2 applied** is shown below.

![](/assets/images/tistory/tistory-82c31cff9454/005.png)

You can see that all addresses change.