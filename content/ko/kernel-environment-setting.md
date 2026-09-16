---
title: "[KERNEL] Environment Setting"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ https://lrl.kr/JT5m カーネルexploitへの導入 | PAWNYABLE!カーネルexploitへの導入 「ユーザーランドのpwnは一通り勉強したけど、カーネルからは難しそうで手が出ない」という方は多いでしょう。しかし、実はカーネルexploitでは、場合"
date: "2024-06-05"
translation_key: "tistory-20d10d01bd1d"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

[https://lrl.kr/JT5m](https://lrl.kr/JT5m)

 [カーネルexploitへの導入 | PAWNYABLE!

カーネルexploitへの導入 「ユーザーランドのpwnは一通り勉強したけど、カーネルからは難しそうで手が出ない」という方は多いでしょう。しかし、実はカーネルexploitでは、場合によってはと

pawnyable.cafe](https://lrl.kr/JT5m)

실습에 있어서 pawnyable.cafe 에 올라와있는 예제파일을 사용하였다.

* * *

예제 파일 다운로드

```
mkdir kernel
cd kernel
wget https://pawnyable.cafe/linux-kernel/LK01/distfiles/LK01.tar.gz
tar -xzvf LK01.tar.gz
```

각자 환경에 맞는 qemu도 설치를 해준다.

```
apt install qemu-system
```

* * *

qemu를 통해 가상 환경을 구축하기 위해서는 리눅스 커널과는 별도로 루트 디렉토리로 마운트되는 디스크 이미지가 필요하다.

cpio는 경량화 된 디스크 이미지 파일이다. 

```
mkdir root
cd root
cpio -idv < ../rootfs.cpio
```

![](/assets/images/tistory/tistory-20d10d01bd1d/001.png)

위와 같이 실행하면 정상적으로 root 디렉토리 안에는 시스템 부팅시 필요한 초기 파일들이 구성되어 있다.

이때 .cpio 파일의 gz으로 압축되어 있는 경우가 많기 때문에 cpio 해제가 안되는 경우 file 명령어를 통해 확인해야 한다.

![](/assets/images/tistory/tistory-20d10d01bd1d/002.png)

디버깅을 할 때 root 계정이 아니라고 하면 브레이크 포인트의 설정이나 함수 주소 확인하는 과정에 있어서 불편하거나 구하지 못하는 부분들이 존재한다. 때문에 먼저 root 권한을 취득하는 과정이 필요하다.

시스템이 시작될 때 /sbin/init이 실행되는데 이는 /etc/init.d/rcS 스크립트를 실행하게 된다.

해당 스크립트에서는 S로 시작하는 파일을 실행하는데 ./etc/init.d/를 살펴보면 S99pawnyable이라는 파일이 있는 것을 볼 수 있다.

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

해당 스크립트에서는 다양한 초기 환경 설정들이 정의되어 있다. 여기서 마지막 줄 setsid를 살펴보겠다.

```
setsid cttyhack setuidgid 1337 sh
```

커널이 기동될 때 사용자 권한으로 셸을 실행하는 코드이다.

root 계정으로 실행하기 위해서는 1337을 0으로 수정해서 저장해주면 된다.

추가로 이후에 다룰 커널 보호 기법을 비활성화 해주어야 한다.

```
#echo 2 > /proc/sys/kernel/kptr_restrict
#echo 1 > /proc/sys/kernel/dmesg_restrict
```

위와 같이 주석 처리 후 저장해주면 된다.

이후 수정한 파일을 다시 cpio로 설정해주겠다.

```
find . -print0 | cpio -o --format=newc --null --owner=root > ../rootfs_updated.cpio
```

이후 run.sh를 수정해보도록 하겠다.

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

  
\-m : 가상 RAM 크기 지정  
\-nographic : CLI 설정  
\-kernel : 커널 이미지 파일 지정  
\-append : 커널의 관한 설정을 추가  
\-cpu : 가상 cpu 설정  
\-smp : cpu 소켓, 코어, 쓰레드 설정  
\-monitor : qemu 실행 중 디버깅 정보를 표시할 모니터 콘솔  
\-initrd : 디스크 이미지 파일 지정  
\-net : 네트워크 카드 설정

위 run.sh파일에 디버깅을 할 수 있도록 아래 옵션을 추가해주면 된다.

  
\-gdb : gdb로 디버깅하기 위한 옵션

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

해당 스크립트를 실행하면 아래처럼 root 권한의 shell에 접속된 것을 볼 수 있다.

![](/assets/images/tistory/tistory-20d10d01bd1d/003.png)
