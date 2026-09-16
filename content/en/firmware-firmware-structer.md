---
title: "[FIRMWARE] FIRMWARE STRUCTER"
description: "Until now, I had only written about my attempts in firmware analysis posts as a secret post. In the future, I will try to write additional posts with the parts I tried + technical content. Before writing this, let me briefly talk about my current situation. I am currently in my 4th year of university, but I was fortunate enough to find a job early and am now working for a company in Seoul. Of course, I'm still an undergraduate student,"
date: "2025-08-23"
translation_key: "tistory-011868369e34"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-FIRMWARE-STRUCT"
private: false
---

Previously, I had only written a record of my attempts to analyze firmware in a secret post.  
From now on, I will try to write more with the parts I tried + technical content.  
   
Before writing, let me briefly talk about my current situation:  
I am currently in my 4th year of university, but luckily I was able to find a job early and am currently working at a company in Seoul.  
  
Of course, since I am still an undergraduate student and do not have much accomplishments or portfolio to prove my skills, I started as an intern instead of a full-time employee.  
I will be working as an intern for 3 months and after completing the evaluation, I will be converted to a full-time employee... Will I be able to do this?  
First of all, as always, I will do my best to study and see what happens next.  
It would be very sad if I couldn't make the switch, but I still don't want to regret it...  
   
The company is currently engaged in IoT-related security research.  
I can't write in detail, so here goes...  
 

* * *

   
Anyone studying security or development has probably heard of firmware.  
   
Low-level software embedded in a hardware device that controls it to function properly  
   
If you ask AI, you will receive the above answer.  
To put it simply, it is a friend that helps various devices such as wireless routers, CCTV, and setup boxes to run.  
   
So what can we do by analyzing these friends?  
Well, of course it is \`해킹\`.  
   
You may have heard about various security incidents in various media such as YouTube and news, such as cases of hacking incidents through public Wi-Fi and privacy exposure due to ipcam hacking.  
Firmware is where these incidents take place.   
Depending on how the firmware is configured and security applied, it can become vulnerable or secure.  
 

* * *

   
Firmware is usually contained in flash memory on the equipment board.  
If you show me a photo of a friend who recently opened the lid...

![](/assets/images/tistory/tistory-011868369e34/001.png)

\[IPCAM BOARD\]

   
   
This part is not covered in relation to firmware extraction in the current post, so it will probably be written in a future post.  
   
I briefly wrote about the structure of the firmware in the confidential article on IPTIME router analysis attempt.  
This time, I would like to write in more detail.  
(If there are any errors, please contact us immediately)  
   
Firmware basically has four structures.  
As an example, let's look at the a2004ml firmware, one of the iptime routers.  
What you need to be aware of at this time is that not all firmware appears to have the same structure.   
There may be differences depending on the manufacturer, and you must be aware that they may be different even from the same manufacturer.  
In other words, the content to be covered now should be considered only as a basic concept, and the process of conducting a project or personal study should be viewed fluidly.  
The picture below was taken to show comparison with other router firmware from the same iptime manufacturer.

![](/assets/images/tistory/tistory-011868369e34/002.png)

   
   
The commands that were used in the picture above and will be used frequently in the future are the binwalk and dd commands.  
We will discuss how to use each in another post. (To make it easier to find and refer to later)  
 

* * *

Now, let's write about the actual structure.  
   
The firmware basically consists of ISP/FDT - UBOOT - RFS - UFS.  
 

#### ISP/FDT

Equipment, including computers, has a main board and numerous chips on it.  
Among them, there is ROM, a non-volatile memory called Read Only Memory.  
The firmware is located right in this ROM.  
   
ISP is now your friend for reading and loading firmware from ROM.   
   
FDT is a friend that tells the Linux kernel how to configure the hardware.  
This friend now exists as a friend called DTB (Device Tree Blob). It contains various information such as CPU and memory size, and is read along with the kernel in uboot. Generally, you can think of it as a hardware initialization process.  
It is created through the process of a developer writing and compiling a DTS (Device Tree Compiler).

```
#DTS -> DTB 컴파일
dtc -I dts -O dtb -o ZZoMb1E.dtb ZZoMb1E.dts

#DTB -> DTS 
dtc -I dtb -O dts -o ZZoMb1E.dts ZZoMb1E.dtb
```

Thankfully, this friend can easily convert anything compiled with DTB to DTS. Thanks to this, analysis is easy.  
   
   
   
   
So what would you know if you got this friend??  
To explain this in detail, there is a slightly complicated section. If I remember this later, I'll cover it in another post. (It's annoying.)  
To put it simply, when the firmware file in memory is uploaded, the entire firmware file is uploaded and operated at once.  
It goes up and operates on a page-by-page basis, and an OOB area (not an Out Of Bounds vulnerability - PWNER) exists in between.  
[https://iptime.com/iptime/?page\_id=126](https://iptime.com/iptime/?page_id=126] This may not be the case when uploading firmware to the Internet, such as IPTIME, but if you obtain the firmware by reading it directly from memory, it becomes difficult to view the memory due to the page unit and OOB area. And because of that part, it is difficult to extract the desired part (not even with binwalk).  
  
At this time, the OOB is removed by referring to the datasheet for the memory chip.   
At this time, DTB information available from FDT allows you to know whether it was removed properly and what memory exists in other session parts. Since it is a hardware initialization process, it is easy to check because it specifies RFS, UBOOT, etc. from which part of the memory.  
   
Well, there aren't many cases where it gets to this point, but...  
   
 

####UBOOT

It is a secondary boot loader that reads the operating system and is responsible for initialization and boot management.  
You can just process it with FDT.  
   
I've never studied or analyzed the bootloader properly...  
What I briefly know is that the kernel, RFS, etc. are imported and processed.  
   
 #### RTS

Now, if you analyze firmware, this is the section you see the most.  
It can be thought of as containing a commonly used Ubuntu environment.  
   
Because it contains Linux basic configuration files + firmware operation files (scripts, binaries, etc.), if you try to analyze it for the first time, it will be difficult to figure out how to analyze it.  
   
It may differ slightly from person to person, but this is how I currently proceed.

1\. /etc/rc.d/ analysis 

This section specifies which scripts, commands, or binaries should be executed once the system boots.  
   
There are three main files inside.  
init.d: ​​Runs when booted and is responsible for executing various services and binaries.  
rc: Executes the specified script according to the boot mode.  
rc.sysinit: A script executed by init.d.  
   
Scripts depending on the mode may exist in various ways, such as rc.d, rc1.d, rc2.d, etc.  
 

2\. Weak function-based navigation

This is also the most common method.  
   
Various vulnerabilities, such as system vulnerabilities and web vulnerabilities, usually occur in specific functions.  
Since it occurs in read(), sprintf(), sprintf(), etc., catch it with grep and track it.

```
grep -rn "func"
```

3\. Script-based binary tracking

It was said that when booting from rc.d, initial configuration and binaries are executed.  
At this time, the executing binary is tracked and vulnerabilities are checked.  
   
You might think it is very different from number 2, but here there is a big difference in the direction and method of analysis.  
Generally, in case 2, the analysis is focused on vulnerabilities, so the first thing to do is check whether vulnerabilities actually occur at the function call point. At this time, if a vulnerability occurs here, we go up and track it one by one to see how it can be triggered/accessed.  
On the other hand, case 3 is closer to system flow analysis rather than vulnerability-based analysis. Because of this, it usually descends slowly from main().   
Here too, analysis methods are divided. There is a way to analyze the entire flow by going down one by one from main(), or to first check whether there is a function in the binary that calls or accesses a specific service/binary or that may cause a system vulnerability, and then attempt to analyze the flow up to that point.  
Normally, when studying individually, everyone will proceed based on weak functions, but if you do an actual project, you have to proceed with the entire flow... I also realized this recently and am trying to study more and improve my skills.  
   
In the case of the iptime ax2004ml model, etc cannot be checked directly.

![](/assets/images/tistory/tistory-011868369e34/003.png)

   
It says there is a link to /tmp/etc, but the /tmp directory is also empty.  
That doesn't mean there isn't a way. In the process of booting and operating, there are cases where you cp or mv real etc that exist in a different path.  
   
Just because something isn't there doesn't mean you can't analyze the firmware, so just proceed.  
 

#### UFS

It is also used for user settings, logs, and data storage.  
   
If the firmware is encrypted, there is a high possibility that there is a decryption binary in this section.  
   
   
 

* * *

Now let's take a look at iptime ax2004ml.

![](/assets/images/tistory/tistory-011868369e34/004.png)

In this case, there are crc data, gzip, lzma, and squashFS.  
   
Well, of course squashFS will be RFS, and we will look at the rest.  
 

![](/assets/images/tistory/tistory-011868369e34/005.png)

   
You can extract the desired part using the command below.  
Normally, if you use binwalk's -eM option, it will automatically extract and decompress everything, but sometimes there are friends who can't do that. In that case, you can use this command.  
 

```
dd if={FRIMWARE_FILE} of={OUTPUT_FILENAME} bs=1 skip={DATA_START_OFFSET} count={DATA_SIZE}
```

   
The CRC data that appears first is for integrity verification or error checking purposes.  
 

![](/assets/images/tistory/tistory-011868369e34/006.png)

   
If you look at the 0x0 section, it is written as follows. If you change this section to little endian, it matches the CRC-32 standard label entry as 0x00000000, 0x77073096, 0xEE0E612C, and 0x990951BA. 

- 00 00 00 00 | 96 30 07 77 | 2c 61 0e ee | ba 51 09 99

* * *

   
To view the gzip file, first decompress it.

![](/assets/images/tistory/tistory-011868369e34/007.png)

![](/assets/images/tistory/tistory-011868369e34/008.png)

   
First of all, without much analysis, you can tell that it is a uboot session.  
 

* * *

   
Files compressed with lzma can be compressed with 7z, but can also be decompressed with the xz command.  
If you look at this file, you can see that it is a Linux version~, that is, a kernel image.

![](/assets/images/tistory/tistory-011868369e34/009.png)

   
If you want to find kernel vulnerabilities later, click here...  
   
 

* * *

Now this is the last session rfs.  
   
There are two methods I use in this section.  
The most used method is to use mount.  
 

![](https://blog.kakaocdn.net/dna/VZiIu/btsP4gk15Mn/AAAAAAAAAAAAAAAAAAAAAJaZk3Fv1ZFoLZz9FPIkQc57F8A0EeidHmtGHMERjvla/img.png?credential=yqXZFxpELC7KVnFOS48ylbz2pIh7yKj8&expires=1756652399&allow_ip=&allow_referer=&signature=qrS5WfPA1mUpOyykJIW5rKgPu40%3D)

```
mkdir -p mnt
sudo mount -t {filesystem:Squashfs, cramfs ...} -o loop,ro {rfs_img_filename} ./mnt
```

   
This will allow you to view the configuration files on your file system.  
At this time, if the file system is corrupted, it cannot be read properly...  
   
Another way is to just decompress it.

```
7z x {rfs_img_filename}
```

Executing this command will decompress all files to the extent that can be interpreted.  
 

![](/assets/images/tistory/tistory-011868369e34/010.png)

   
   
Now all you have to do is do the analysis!! Ugh!!