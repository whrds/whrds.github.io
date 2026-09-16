---
title: "[ASUS] FIRMWARE ANAYZLE #3"
description: "While continuing to analyze IPTIME, I felt that I would not be able to make progress for that model without acquiring equipment or disassembling the existing equipment, so I tried changing the TARGET. This time, I want to make emulation easier. I will use emulating tools, including FIRMAE, and organize the list to select a target."
date: "2025-06-23"
translation_key: "tistory-7789b9c0fa08"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/ASUS-FIRMWARE-ANAYZLE-3"
private: false
---

While continuing to analyze IPTIME, I felt that I would not be able to make progress for that model without acquiring equipment or disassembling the existing equipment, so I tried changing the TARGET.

![](/assets/images/tistory/tistory-7789b9c0fa08/001.png)

This time, I wanted to make emulating easier, so I tried to select a target by using emulating tools, including FIRMAE, and organizing the list. But surprisingly, it has never been successful in my environment...

In the end, I decided to select a suitable device and emulate and analyze it myself.

The selected equipment is ASUS's RT\_AX57.

![](/assets/images/tistory/tistory-7789b9c0fa08/002.png)

Since we first started the project with two people, we chose this equipment that costs about 40,000 won per person.

(Hmm... I ended up going it alone in the middle...)

First of all, attempts to use emulating tools for this equipment failed.

![](/assets/images/tistory/tistory-7789b9c0fa08/003.png)

![](/assets/images/tistory/tistory-7789b9c0fa08/004.png)

If you check it through binwalk, you can see that it is more complicated than iptime. 

The structures of dtb, kernel img, and rootfs are the same, but the internal properties are shown more separately. I will not write about this separately because I have extracted each of these and summarized the analysis once in iptime.

![](/assets/images/tistory/tistory-7789b9c0fa08/005.png)

It uses ARM architecture.

![](/assets/images/tistory/tistory-7789b9c0fa08/006.png)

First, I confirmed that the httpd protocol exists.

![](/assets/images/tistory/tistory-7789b9c0fa08/007.png)

![](/assets/images/tistory/tistory-7789b9c0fa08/008.png)

As a result of analysis through IDA PRO, it was confirmed that unlike iptime, the boa process was not renamed but httpd.

![](/assets/images/tistory/tistory-7789b9c0fa08/009.png)

I checked to see if there were cgi files, but they did not exist in the extracted files.

![](/assets/images/tistory/tistory-7789b9c0fa08/010.png)

Nevertheless, there are asp files and binary files that use cgi.

![](/assets/images/tistory/tistory-7789b9c0fa08/011.png)

It was confirmed that the cgi file was implemented as internal logic within the httpd process.

And the friend you should have checked first is rc.d.

![](/assets/images/tistory/tistory-7789b9c0fa08/012.png)

It should be possible to check all the processes running when booting through that path, but the necessary script does not exist. 

It seems that the extraction is not done properly or is performed in init.

![](/assets/images/tistory/tistory-7789b9c0fa08/013.png)

Check the init path.

![](/assets/images/tistory/tistory-7789b9c0fa08/014.png)

Then, I analyzed the scripts, and most of them were hardware setup and system initialization scripts, and I could not find any logic that raises the file system and runs various processes.

Leaving aside detailed process analysis, I first attempted to emulate the httpd process.

![](/assets/images/tistory/tistory-7789b9c0fa08/015.png)

To restore the conf file, I searched as if I had restored the boa script in iptime, but httpd was executing it by referring to the conf logic implemented internally. Therefore, I decided that there was no need to restore it separately, so I immediately revived the process.

![](/assets/images/tistory/tistory-7789b9c0fa08/016.png)

```
sudo qemu-arm-static -L ./ ./usr/sbin/httpd
```

First of all, there were two main types of errors.

1\. A message indicating failure is output during the netlink socket initialization process. This is said to be because netlink sockets are not fully supported in QEMU user mode. However, this part is not a big problem, so you can ignore it.

2\. Port 80, which httpd requires, is already in use. For this part, simply stop apache2 that is using port 80 or change the port using the -p option and try again.

Afterwards, create the /var/run path and try again.

![](/assets/images/tistory/tistory-7789b9c0fa08/017.png)

If you do this, you will see that only the netlink message appears. If you try to access the web at this time...

![](/assets/images/tistory/tistory-7789b9c0fa08/018.png)

Once the connection fails, a segment fault occurs in the terminal.

![](/assets/images/tistory/tistory-7789b9c0fa08/019.png)

Wow...ohhh....

To solve this part, I used the command strace. This command is a command that tracks syscalls or signals.

```
sudo strace -f  chroot . ./qemu-arm-static ./usr/sbin/httpd
```

By inputting data like this, the log was output and analysis was attempted.

![](/assets/images/tistory/tistory-7789b9c0fa08/020.png)

Tracking is possible in this way, but there were two main problems identified through the logs.

1\. The nvram series functions used in ASUS models are highly dependent on hardware. Therefore, when the functions are called, they do not work properly and terminate. 2\. It says the path is wrong. When analyzing iptime and referring to various references, the command must be executed from the home path of the rootfs file system. However, when I look at the log while trying to emulate Asus, I can't find the asp files that need to be executed.

First, to solve problem number 2, I modified the path to ./www/.

![](/assets/images/tistory/tistory-7789b9c0fa08/021.png)

If you modify the path, you will be able to view various web-related files, but other commands or conf configuration information will not be loaded. Therefore, the paths such as ./bin and ./usr were moved to ./www.

Afterwards, I tried function hooking to solve problem number 1.

The functions to hook are nvram\_get(), nvram\_get\_init(), nvram\_set(), nvram\_unset(), and nvram\_commit().

For the corresponding functions, the c file was structured as follows. In particular, in the case of the nvram\_get() function, the values ​​that must be returned are different depending on the value, so libnvram.so was analyzed and the return value was set.

![](/assets/images/tistory/tistory-7789b9c0fa08/022.png)

```
#define _GNU_SOURCE
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

const char* nvram_get(const char* name) {
    fprintf(stderr, "[fake_nvram] get(%s)\n", name);

    if (strcmp(name, "http_enable") == 0) return "1";
    if (strcmp(name, "login_timestamp") == 0) return "1749615239";
    if (strcmp(name, "productid") == 0) return "RT-AX57";
    if (strcmp(name, "odmpid") == 0) return "RT-AX57U";
    if (strcmp(name, "preferred_lang") == 0) return "EN";
    if (strcmp(name, "lan_ipaddr") == 0) return "192.168.1.1";
    if (strcmp(name, "lan_netmask") == 0) return "255.255.255.0";
    if (strcmp(name, "debug_cprintf") == 0) return "1";
    if (strcmp(name, "debug_cprintf_file") == 0) return "/dev/null";
    if (strcmp(name, "x_Setting") == 0) return "1";
    if (strcmp(name, "territory_code") == 0) return "US";
    if (strcmp(name, "https_lanport") == 0) return "8443";

    return "";
}

int nvram_get_int(const char* name) {
    fprintf(stderr, "[fake_nvram] get_int(%s)\n", name);

    if (strcmp(name, "HTTPD_DBG") == 0) return 0;
    if (strcmp(name, "httpd_force_lock") == 0) return 0;
    if (strcmp(name, "x_Setting") == 0) return 1;

    return 0;
}

int nvram_set(const char* name, const char* value) {
    fprintf(stderr, "[fake_nvram] set(%s, %s)\n", name, value);
    return 0;
}

int nvram_unset(const char* name) {
    fprintf(stderr, "[fake_nvram] unset(%s)\n", name);
    return 0;
}

int nvram_commit(void) {
    fprintf(stderr, "[fake_nvram] commit()\n");
    return 0;
}
```

Write the file and cross-compile it with arm.

```
sudo apt install gcc-arm-linux-gnueabi
arm-linux-gnueabi-gcc -shared -fPIC -o libnvram_fake.so fake_nvram.c
```

Afterwards, execute the command below.

```
sudo strace -f  chroot ./www/ ./qemu-arm-static -E LD_PRELOAD=./libnvram_fake.so ./usr/sbin/httpd
```

If you want to analyze through gdb, open the gdb server here.

![](/assets/images/tistory/tistory-7789b9c0fa08/023.png)

Emulation was (partially) successful.

Accordingly, we verified and reported the suspected vulnerability code we had found.

![](/assets/images/tistory/tistory-7789b9c0fa08/024.png)

[https://www.asus.com/content/asus-product-security-advisory/](https://www.asus.com/content/asus-product-security-advisory/)

 [ASUS Product Security Advisory｜ASUS Global

[www.asus.com](https://www.asus.com/content/asus-product-security-advisory/)

Reports can be made at this URL.

Afterwards, I wanted to run the shell to perform additional process analysis and make additional attempts, such as emulating.

![](/assets/images/tistory/tistory-7789b9c0fa08/025.png)

Hmm... But there is no shell and it is replaced with memaccess...

This is a binary for ASUS router developers and is intended to block root shells. We are researching/analyzing ways to circumvent this...

![](/assets/images/tistory/tistory-7789b9c0fa08/026.png)

They said that emulation was partially successful, but the login process does not work properly unless you connect to GDB and adjust the values. I plan to do a little more research on this.

What I have gained from analyzing and researching so far is as follows.

1\. Firmware analysis method

   1-1. Firmware Structure 

   1-2. Analysis procedures and significance

2\. Emulating method

    2-1. conf file recovery

    2-2. Function hooking

    2-3. Log analysis and error approach using strace

3\. Vulnerability Analysis

    3-1. Vulnerability reporting experience