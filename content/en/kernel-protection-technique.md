---
title: "[KERNEL] Protection technique"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ SMEP (Supervisor Mode Execution Prevention) is a technique that prevents the execution of user space code while executing kernel space code. It is similar to NX (No Exute), which prevents the execution of code in user space. It is a hardware security technique."
date: "2024-06-13"
translation_key: "tistory-d725f51a7ecb"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-%EB%B3%B4%ED%98%B8-%EA%B8%B0%EB%B2%95"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

#### SMEP (Supervisor Mode Execution Prevention)

This is a technique that prevents the execution of user space code while executing kernel space code.

It is similar to NX (No Exute), which prevents the execution of code in user space.

As a hardware security technique, SMEP is triggered when the 21st bit of the CR4 register is activated.

To set it up, just add the following part to the sh file that builds the kernel environment.

```
-cpu kvm64, +smep
```

To check whether a protection technique is in effect within the environment, run the command below.

```
cat /proc/cpuinfo | grep smep
```

* * *

#### SMAP (Supervisor Mode Access Prevention)

There are restrictions on not being able to read and write memory in kernel space from user space, but there are no restrictions on reading memory in user space from kernel space. SMAP prevents this from happening.

Because the Linux kernel is very large, the following gadgets exist.

```
mov esp, 0x12345678; ret;
```

You can configure a rope chain using mmap() in user space.

```
void *p = mmap(0x12340000, 0x10000, ...);
unsigned long *chain = (unsigned long*)(p + 0x5678);
*chain++ = rop_pop_rdi;
*chain++ = 0;
*chain++ = ...;
...

control_rip(rop_mov_esp_12345678h);
```

Assuming that only SMEP is enabled, the space allocated with mmap() does not limit execution. 

In other words, if you run the above code, rip can be manipulated. However, if SMAP occurs, 0x12345678 is used in user space, but the value cannot be read in kernel space.

This prevents stack pivoting.

As a hardware security technique, SMEP is triggered when the 22nd bit of the CR4 register is activated.

You can configure it by adding the following command to the script file that builds the environment.

```
-cpu kvm64,+smap
```

You can check whether the technique is running inside the environment using the command below.

```
cat /proc/cpuinfo | grep smap
```

* * *

#### KASLR / KGKASLR

In user space, there is an ASLR technique that randomizes memory addresses. 

Likewise, in kernel space, there is a KASLR technique that randomizes the address of the code/data area of ​​the Linux kernel or device driver.

Because the kernel, once loaded, does not change until rebooted, KASLR only runs once on initial boot.

You can control settings through the code below.

```
-append "... nokaslr ..."
```

* * *

#### KPTI (Kernel Page-Table Isolation)

This is a protection technique that was developed as a response to a vulnerability called Meltdown, which is a vulnerability that allows memory in kernel space to be read with user privileges.

When converting from a virtual address to a physical address, a page-table is used, which distinguishes between kernel space and user space.

Generally, this is not a problem for exploits, but it may be blocked during processes such as ret2usr after ROP is performed in the kernel.

```
# kpti on
-append "... pti=on ..."

# kpti off
-append "... pti=off ..."
-append "... nopti ..."
```

You can log in using the following command in the kernel environment. ㅣㅆda.

```
# cat /sys/devices/system/cpu/vulnerabilities/meltdown
Mitigation: PTI
```

* * *

#### KADR (Kernel Address Display Restriction)

The kernel can read the function name and information using /proc/kallsyms or, depending on the driver, printk().

In this way, the technique to prevent the leakage of address information such as functions, data, and heaps in kernel space is commonly called KADR.

The level of protection is set based on the value in the /proc/sys/kernel/kptr\_restrict file.

0: address display

1: Visible only to users with CAP\_SYSLOG privileges

2: Do not display address