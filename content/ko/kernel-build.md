---
title: "[KERNEL] build"
description: "※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다. ※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다. Kernel 1-day를 분석하기 위해서는 User 공간에서 1-day 분석을 위해 환경 구축을 했던 것처럼, 취약한 버젼에 맞는 Kernel 버젼을 build "
date: "2024-11-12"
translation_key: "tistory-696de103e19e"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-build"
private: false
---

**※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다.** 

**※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다.**

  Kernel 1-day를 분석하기 위해서는 User 공간에서 1-day 분석을 위해 환경 구축을 했던 것처럼, 취약한 버젼에 맞는 Kernel 버젼을 build 해야한다. 이를 위해 준비해야 하는 것은 취약한 버젼에 맞는 bzimage, vmlinux 그리고 PoC 동작을 할 바이너리를 가지고 있는 rootfs 이미지 파일이다.

Kernel 1-day 중 하나인 CVE-2022-1015를 분석하기 위해 Kernel 환경 구축에 대해 공부를 하였으며 이를 작성해보고자 한다.

* * *

#### 1\. Kernel source install

먼저 취약한 버젼에 맞는 Kernel 파일을 설치를 해야한다. 이를 위해 git을 사용하겠다.

```
git clone git://git.kernel.org/pub/scm/linux/kernel/git/stable/linux-stable.git
```

![](/assets/images/tistory/tistory-696de103e19e/001.png)

명령을 수행하는데 Kernel 파일의 용량이 매우 크기 때문에 시간이 좀 소요된다.

이후 빌드를 위해서 필요한 패키지를 설치해준다.

```
wget https://mirrors.edge.kernel.org/pub/linux/kernel/[version]

tar -xzvf ./kernel.tar.gz
```

wget으로 설치를 진행해도 된다.

이렇게 진행할 경우 압축해제도 진행해주어야 한다.

#### 2\. Install package

```
sudo apt-get install git-all fakeroot build-essential ncurses-dev xz-utils libssl-dev bc flex libelf-dev bison
```

이와 같은 package 들을 설치를 해주게 되면 정상적으로 이후 작업을 수행할 수 있다.

#### 3\. Version check

```
git checkout -b CV5.12.2 v5.12.2

____________________________________________________________________________________

git checkout[commit code]
-> ex)  git checkout 9f4ad9e425a1d3b6a34617b8ea226d56a119a717
```

이후 방법로 git의 commit 값을 아는 경우 해당 값을 작성하거나 설치하고자 하는 버젼을 위와 같은 형식으로 작성해주면 된다.

#### 4\. Prepare .config

여기서는 방법이 2가지로 나뉘게 된다.

현재 사용중인 Linux 환경 Kernel의 .config 파일을 그대로 가져다 쓰거나 새로 생성하는 방법이 있다.

4-1. Copy Kernel config

```
mkdir build
cd build
cp /boot/config-$(uname -r) .config
```

위와 같은 uname-r 명령을 사용해서 현재 계정에 대한 정보를 가지고 .config를 찾아 가져온다.

이후 .config 파일을 열어 아래의 내용을 주석 처리해준다.

```
CONFIG_MODULE_SIG_ALL
CONFIG_MODULE_SIG_KEY
CONFIG_SYSTEM_TRUSTED_KEYScd
```

  
  

4-2. Make New Default config

```
make defconfig
```

가장 기본적인 .config 파일을 생성하는 것으로 내부 값들 설정이 되어 있지 않기 때문에 build 하면서 설정을 해주어야 한다.

4-3. Make New Setting config

Default 값이 아닌 Kernel에 대한 Debug 설정을 수행하고자 하면 이 방법으로 진행해야 한다.

(기타 설정들도 직접 적용하고 싶다면..) -> 위의 방법들로

```
make manuconfig
```

해당 명령을 입력하게 되면 파란 배경에 회색창이 뜨게 된다. (TMI : CLI 환경에서도 동일하게 뜬다. 필자는 개인 서버에 remote에서 공부를 하는데 GUI 처럼 되길래 좀 신기했다.)

여기서 설정해줄 것은 크게 2가지이다.

![](/assets/images/tistory/tistory-696de103e19e/002.png)

먼저 \[Kernel hacking\]에 들어가준다.

![](/assets/images/tistory/tistory-696de103e19e/003.png)

여기서 \[Compile-time checks and compiler options\]으로 들어간다.

![](/assets/images/tistory/tistory-696de103e19e/004.png)

이후 가장 상단의 \[Compile the kernel with debug info\]를 **Y**키를 입력하여 체크해준다.

2번째 설정은 \[Kernel hacking\] 부분에서 KGPG인가 있다는데 필자의 환경에서는 해당 설정이 존재하지 않았다.

![](/assets/images/tistory/tistory-696de103e19e/005.png)

설정을 다했으면 \[SAVE\]로 저장하고 나가면 .config 파일이 생성되어 있다.

#### 5\. make 

```
make -j$(nproc) O=../build/
```

설정을 다 했으면 위와 같이 입력하여 build를 수행해주면 된다.

이때 각종 설정에 대한 y, m, n 등 어떻게 할 것인지 입력하라는 부분이 많이 뜨는데 그냥 \[ENTER\]키를 길게 눌려준다.이렇게 해버리면 기본값으로 자동 설정된다. (하나하나 읽어보며 할 필요가 없다!!)

![](/assets/images/tistory/tistory-696de103e19e/006.png)

빌드하는 환경에 따라 다르겠지만 필자는 1시간 이상이 소요되었다.

* * *

**SO...long... time....**

* * *

![](/assets/images/tistory/tistory-696de103e19e/007.png)

위와 같이 파일들이 정상적으로 생성이 되었다면 bzImage, vmlinux가 있는지를 확인한다.

![](/assets/images/tistory/tistory-696de103e19e/008.png)

arch/x86/boot/ 경로에 들어가면 bzImage가 있는 것을 볼 수 있다. 이 파일과 vmlinux 파일을 이용해서 이후 Kernel을 실행하면 된다.

* * *

#### 6\. rootfs img

Kernel을 실행하기 위해서는 rootfs 이미지가 필요하다. 이를 위해 debootstrap을 사용한다.

```
sudo debootstrap --arch amd64 jammy /path/to/rootfs http://archive.ubuntu.com/ubuntu
```

위 명령을 실행하면 /path/to/rootfs에 이미지 파일이 생성되게 된다.

경로는 원하는 경로로 설정해주어야 한다.

이후 과정은 간단하다. 

img 파일을 원하는 구성에 맞게 수정해주고 아래와 같이 script를 실행하면 된다.

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
