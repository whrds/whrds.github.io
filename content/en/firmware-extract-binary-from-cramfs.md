---
title: "[FIRMWARE] EXTRACT BINARY FROM CRAMFS"
description: "In the process of analyzing the firmware, if it is not available online and shell access is blocked using a method such as UART, an attempt is made to extract the firmware directly from the chip. However, during this process, the firmware will generally be extracted normally, but in rare cases, a situation may arise where it is not extracted properly. Explained in an analogy that is easy for non-majors to understand"
date: "2025-08-23"
translation_key: "tistory-daa9a0bc0337"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-EXTRACT-BINARY-FROM-CRAMFS"
private: false
---

In the process of analyzing the firmware, if it is not available online and shell access is blocked using a method such as UART, an attempt is made to extract the firmware directly from the chip.

However, during this process, the firmware will generally be extracted normally, but in rare cases, a situation may arise where it is not extracted properly.

Let me explain it with an analogy that is easy for non-majors to understand:

There is a solid tower of blocks stacked well together. However, in the process of moving this, the block located in the middle is missing or the direction is disturbed.

In this situation, can it be said that the tower in question is exactly the same as the original solid tower?

The firmware is also like this.

If the internal data changes because the firmware is not extracted properly during the extraction process, it is no longer the exact same firmware as the original. 

Therefore, there may be parts that are not properly extracted from the internal binary or script. 

Of course, you won't be able to decompress it before that. 

There are various compression methods such as gzip and cramfs.

And each method has its own unique structure, and if this is broken or tampered with, decompression will not work properly.

In this situation, should I just give up??

If it's cramfs, there is a way!!!

Even if you cannot properly analyze the entire firmware, you can extract some of the internal scripts or binaries.

Of course, compressing the entire data like gzip is close to impossible because the integrity due to CRC cannot be maintained, but it is possible with cramfs.

The cramfs structure is simpler than you think.

![](/assets/images/tistory/tistory-daa9a0bc0337/001.png)

\[Image source: https://blog.naver.com/lovinghc/30039653478\]

Now, for illustration purposes, we will prepare a file system compressed with cramfs.

The rfs of iptime a2004ml was recompressed into cramfs.

![](/assets/images/tistory/tistory-daa9a0bc0337/002.png)

If you check the compressed file with the xxd command, you can see file names such as binary and directory.

![](/assets/images/tistory/tistory-daa9a0bc0337/003.png)

Now, let's find the compressed data of the binary along with information about the file in the header of the file compressed with cramfs.

![](/assets/images/tistory/tistory-daa9a0bc0337/004.png)

The above definition is expressed graphically as shown above.

In a situation where file decryption is complex, there is no need to check that part.

There is no major problem if you just check blocks and files. (BLOCKS: 0x133e, FILES: 0x02b9)

Now we will look at the INODE part. This contains information about which OFFSET the compressed data is located in, whether the file is a binary/directory, and what the permissions are.

There are many directories and binaries in rfs. Among these, let's look at the httpd directory.

![](/assets/images/tistory/tistory-daa9a0bc0337/005.png)

If you search httpd in the INODE section, you can confirm that httpd data exists starting from 0x1068.

To explain each piece of information in INODE,

1\. \[ fd41 e803 -> 0x03e841fd \] 

-UID: 0xe803
- MODE: 0x41fd (0x4000: direcotry, permission: 0775)

2\. \[ fc00 00e8 -> 0xe80000fc \]

- SIZE: 0xfc = 252 Bytes
- GID: 0xe8

3\. \[ c207 0100 -> 0x000107c2 \]

- Top 6 bits: namelen -> 0x2 (8 bytes)
- Lower 26 bits: data offset -> 0x107c

![](/assets/images/tistory/tistory-daa9a0bc0337/006.png)

0x107c is also an INODE structure section and contains binary information.

\# Because httpd is a directory, it does not have separate data information, so it has data about files that exist inside.

Now, if you want to decrypt the binary, you can trace it in the same way.

![](/assets/images/tistory/tistory-daa9a0bc0337/007.png)

Now I'm going to try to recover files, but this time I'm not going to decrypt directories or other files, but busybox.

It is a busybox file with 755 permissions on regular binary files.

The offset is 0x13408.

![](/assets/images/tistory/tistory-daa9a0bc0337/008.png)

When you enter that section, you can see that there is not compressed data, but a pointer table pointing to another location.

INODE's data offset does not mean the location of the compressed data, but has a value for a pointer table that contains the actual location of the compressed data.

At this time, the reason why there are multiple pointers instead of a single pointer is because the data is separated by page. 

This is because the firmware in the flash memory is not loaded and operated as is, but is divided into pages and updated.

Additionally, data compressed by cramfs is compressed by zlib. Because the compression method has a limited maximum size when compressed, multiple compressed data exist within it. 

![](/assets/images/tistory/tistory-daa9a0bc0337/009.png)

Now, if we look at the pointers, there is a signature called 0x78da.

This is the beginning of the zlib file compressed with DEFLATE, and it is a single chunk of data until the next zlib signature appears.

Now, you can try decoding by detecting the zlib signature from this 0x14b2a offset to the end of the data size.

If you don't want to bother writing code, you can just ask the AI ​​and it will tell you well, so I won't post it.