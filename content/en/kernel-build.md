---
title: "[KERNEL] build"
description: "※ Since the analysis was conducted with reference to the data, there may be errors. ※ If there is anything that needs to be supplemented or corrected, please let us know and we will take action after checking. To analyze Kernel 1-day, build a Kernel version that matches the vulnerable version, just as you built the environment for 1-day analysis in the user space."
date: "2024-11-12"
translation_key: "tistory-696de103e19e"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-build"
private: false
---

**※ Since the analysis was conducted with reference to the data, there may be errors.** 

**※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action.**

  In order to analyze Kernel 1-day, you must build a Kernel version that matches the vulnerable version, just as you built the environment for 1-day analysis in the user space. What you need to prepare for this is bzimage, vmlinux, and a rootfs image file that contains the binaries for PoC operation that match the vulnerable version.

In order to analyze CVE-2022-1015, one of the Kernel 1-days, I studied Kernel environment construction and would like to write it.

* * *

#### 1\. Kernel source install

First, you must install the Kernel file appropriate for the vulnerable version. For this we will use git.

```
git clone git://git.kernel.org/pub/scm/linux/kernel/git/stable/linux-stable.git
```

![](/assets/images/tistory/tistory-696de103e19e/001.png)

Executing the command takes some time because the Kernel file is very large.

Afterwards, install the necessary packages for the build.

```
wget https://mirrors.edge.kernel.org/pub/linux/kernel/[version]

tar -xzvf ./kernel.tar.gz
```

You can also proceed with installation using wget.

If you proceed this way, you must also proceed with decompression.

#### 2\. Install package

```
sudo apt-get install git-all fakeroot build-essential ncurses-dev xz-utils libssl-dev bc flex libelf-dev bison
```

If you install these packages, you can perform subsequent tasks normally.

#### 3\. Version check

```
git checkout -b CV5.12.2 v5.12.2

____________________________________________________________________________________

git checkout[commit code]
-> ex)  git checkout 9f4ad9e425a1d3b6a34617b8ea226d56a119a717
```

If you know the commit value of git in the later method, you can write that value or write the version you want to install in the format above.

#### 4\. Prepare.config

Here, the methods are divided into two.

There is a way to either use the .config file of the Linux environment kernel currently in use or create a new one.

4-1. Copy Kernel config

```
mkdir build
cd build
cp /boot/config-$(uname -r) .config
```

Use the uname-r command above to find and retrieve .config with information about the current account.

Afterwards, open the .config file and comment out the contents below.

```
CONFIG_MODULE_SIG_ALL
CONFIG_MODULE_SIG_KEY
CONFIG_SYSTEM_TRUSTED_KEYScd
```

  
  

4-2. Make New Default config

```
make defconfig
```

Since the internal values are not set by creating the most basic .config file, you must configure them while building.

4-3. Make New Setting config

If you want to perform debug settings for a kernel other than the default value, you must proceed in this way.

(If you want to apply other settings directly...) -> Use the methods above.

```
make manuconfig
```

When you enter the command, a gray window will appear on a blue background. (TMI: It appears the same in the CLI environment. I study remotely on a personal server, and it was a bit surprising that it looked like a GUI.)

There are two main things to set here.

![](/assets/images/tistory/tistory-696de103e19e/002.png)

First, go to \[Kernel hacking\].

![](/assets/images/tistory/tistory-696de103e19e/003.png)

Here, go to \[Compile-time checks and compiler options\].

![](/assets/images/tistory/tistory-696de103e19e/004.png)

Afterwards, check \[Compile the kernel with debug info\] at the top by pressing the **Y** key.

The second setting says that there is KGPG in the \[Kernel hacking\] section, but that setting did not exist in my environment.

![](/assets/images/tistory/tistory-696de103e19e/005.png)

When you have completed the settings, save with \[SAVE\] and exit. A .config file will be created.

#### 5\. make 

```
make -j$(nproc) O=../build/
```

Once you have completed the settings, enter the following to execute the build.

At this time, a lot of prompts will appear asking you to enter y, m, n, etc. for various settings, but just press and hold the \[ENTER\] key. If you do this, it will automatically be set to the default value. (There is no need to read them one by one!!)

![](/assets/images/tistory/tistory-696de103e19e/006.png)

It may vary depending on the building environment, but for me, it took more than an hour.

* * *

**SO...long...time....**

* * *

![](/assets/images/tistory/tistory-696de103e19e/007.png)

If the files were created normally as above, check whether bzImage and vmlinux exist.

![](/assets/images/tistory/tistory-696de103e19e/008.png)

If you enter the arch/x86/boot/ path, you can see that bzImage is there. You can then run the Kernel using this file and the vmlinux file.

* * *

#### 6\. rootfs img

A rootfs image is required to run the kernel. For this, debootstrap is used.

```
sudo debootstrap --arch amd64 jammy /path/to/rootfs http://archive.ubuntu.com/ubuntu
```

When you execute the above command, an image file will be created in /path/to/rootfs.

The path must be set to the desired path.

The subsequent process is simple. 

Just modify the img file to suit your desired configuration and run the script as shown below.

```
#!/bin/sh
qemu-system-x86_64 \
    -m 64M \
    -nographic \
    -kernel bzImage \
    -append "console=ttyS0 loglevel=3 oops=panic panic=-1 nopti nokaslr" \
    -no-reboot \
    -cpu qemu64, +smep \
    -gdb tcp::12345 \
    -smp 1 \
    -monitor /dev/null \
    -initrd debugfs.cpio \
    -net nic,model=virtio \
    -net user
```