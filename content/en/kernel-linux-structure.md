---
title: "[KERNEL] Linux Structure"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ In order to learn about exploits in the kernel area, you must be aware of what the kernel is. The basic structure of Linux is shown in the picture above. When we deal with Linux, we enter various commands. At this time, we Shell"
date: "2024-06-05"
translation_key: "tistory-dbb2dbc260c4"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Linux-Structure"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

In order to learn about exploits in the kernel area, you must be aware of what the kernel is.

![](/assets/images/tistory/tistory-dbb2dbc260c4/001.png)

The basic structure of Linux is shown in the picture above.

When we deal with Linux, we enter various commands. At this time, we will deal with the part called Shell. Afterwards, the Kernel is responsible for managing and interpreting the commands we enter so that they can operate on the hardware.

* * *

####Shell

The basic shell serves as an interface between the user and the kernel.

• **Command Interpretation**: Interprets the command entered by the user and transmits it to the kernel.  
   The command entered by the user is interpreted by the shell and passed to the kernel, and the kernel processes it and returns the result back to the shell.

• **Scripting**: Shell scripting allows automation of complex tasks.

• **User Environment Management**: Management of environment variables and settings.

* * *

#### Kernel

The kernel can be seen as the core of the operating system. It serves as a mediator between commands received from the hardware and the shell. In addition, it is responsible for managing and efficiently distributing system resources.

• **Memory Management**: Virtual memory and physical memory management (functions such as allocation/release/replacement)

• **Process Management**: Manages the life cycle of process creation, termination, and scheduling.

• **Security**: Manages system aspects such as memory and processes to prevent interference with other process spaces and blocks access to kernel space.

* * *

#### Context switch

Context switching is an operation in which a thread or process saves its execution state and switches to another process or thread. This enables multitasking and ensures efficient use of the system's resources.

![](/assets/images/tistory/tistory-dbb2dbc260c4/002.png)

https://m.blog.naver.com/rhkdals1206/221575121342

While executing each thread, if a command cannot be executed in that area, it is executed in another space, or when an interrupt occurs, execution is temporarily exchanged with another thread. At this time, there is a process of saving the existing state information and recovering it again after executing another process.