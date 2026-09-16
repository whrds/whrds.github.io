---
title: "[KERNEL] Environment Setting"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ https://lrl.kr/JT5m カーネルexploitへの導入 | PAWNYABLE!カーネルexploitへの導入「ユーザーランドのpwnは一通り勉強したけど、カーネルからは難しそうで㉋が\"Go out\" and do many things."
date: "2024-06-05"
translation_key: "tistory-20d10d01bd1d"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

[https://lrl.kr/JT5m](https://lrl.kr/JT5m)

 [カーネルexploitへの導入 | PAWNYABLE!

カーネルexploitへの導入「ユーザーランドのpwnは一通り勉強したけど、カーネルからは難しそうで手が出ない「という方はいでしょう。しかし、実はカーネルexploitでは、場合によってはと

pawnyable.cafe](https://lrl.kr/JT5m)

In the practice, we used the example file posted on pawnyable.cafe.

* * *

Download example file

```
mkdir kernel
cd kernel
wget https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01.tar.gz
tar -xzvf LK01.tar.gz
```

It also installs qemu appropriate for each environment.

```
apt install qemu-system
```

* * *

To build a virtual environment through qemu, a disk image that is mounted as the root directory is required separately from the Linux kernel.

cpio is a lightweight disk image file. 

```
mkdir root
cd root
cpio -idv < ../rootfs.cpio
```

![](/assets/images/tistory/tistory-20d10d01bd1d/001.png)

If you execute the above, the initial files necessary for system booting are normally located in the root directory.

At this time, since it is often compressed with gz in the .cpio file, if cpio cannot be released, you must check it using the file command.

![](/assets/images/tistory/tistory-20d10d01bd1d/002.png)

When debugging, if you do not use the root account, there are parts that are inconvenient or cannot be obtained in the process of setting breakpoints or checking function addresses. Therefore, it is necessary to first acquire root privileges.

When the system starts, /sbin/init is run, which runs the /etc/init.d/rcS script.

In this script, files that start with S are executed. If you look at ./etc/init.d/, you can see that there is a file called S99pawnyable.

```
#!/bin/sh

##
## Setup
##
mdev -s
mount -t proc none /proc
mkdir -p /dev/pts
mount -vt devpts -o gid=4,mode=620 none /dev/pts
chmod 666 /dev/ptmx
stty -opost
echo 2 > /proc/sys/kernel/kptr_restrict
#echo 1 > /proc/sys/kernel/dmesg_restrict

##
## Install driver
##
insmod /root/vuln.ko
mknod -m 666 /dev/holstein c `grep holstein /proc/devices | awk '{print $1;}'` 0

##
## User shell
##
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"
echo "[ Holstein v1 (LK01) - Pawnyable ]"
setsid cttyhack setuidgid 1337 sh

##
## Cleanup
##
umount /proc
poweroff -d 0 -f
```

In this script, various initial environment settings are defined. Let's look at the last line setsid here.

```
setsid cttyhack setuidgid 1337 sh
```

This is code that runs a shell with user privileges when the kernel is started.

To run it with the root account, change 1337 to 0 and save it.

Additionally, you must disable the kernel protection techniques that will be discussed later.

```
#echo 2 > /proc/sys/kernel/kptr_restrict
#echo 1 > /proc/sys/kernel/dmesg_restrict
```

Just comment it out as above and save it.

Afterwards, I will set the modified file back to cpio.

```
find . -print0 | cpio -o --format=newc --null --owner=root > ../rootfs_updated.cpio
```

Next, we will modify run.sh.

```
#!/bin/sh
qemu-system-x86_64 \
    -m 64M \
    -nographic \
    -kernel bzImage \
    -append "console=ttyS0 loglevel=3 oops=panic panic=-1 nopti nokaslr" \
    -no-reboot \
    -cpu qemu64 \
    -smp 1 \
    -monitor /dev/null \
    -initrd rootfs.cpio \
    -net nic,model=virtio \
    -net user
```

  
\-m : Specifies virtual RAM size  
\-nographic : CLI settings  
\-kernel: Specify kernel image file  
\-append: Add kernel-related settings  
\-cpu: virtual cpu settings  
\-smp : CPU socket, core, thread settings  
\-monitor : Monitor console to display debugging information while qemu is running  
\-initrd : Specify disk image file  
\-net : Network card settings

To enable debugging, just add the option below to the run.sh file above.

  
\-gdb : Options for debugging with gdb

```
#!/bin/sh
qemu-system-x86_64 \
    -m 64M \
    -nographic \
    -kernel bzImage \
    -append "console=ttyS0 loglevel=3 oops=panic panic=-1 nopti nokaslr" \
    -no-reboot \
    -cpu qemu64 \
    -smp 1 \
    -monitor /dev/null \
    -initrd rootfs_updated.cpio \
    -net nic,model=virtio \
    -net user \
    -gdb tcp::1234
```

When you run the script, you can see that you are connected to a shell with root privileges as shown below.

![](/assets/images/tistory/tistory-20d10d01bd1d/003.png)