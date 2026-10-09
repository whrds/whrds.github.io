---
title: "[PS4] PS4 Pro Research: From a Flash Dump to Kernel Code Analysis"
description: "Following the work from opening a PS4 Pro and reading its flash to reviewing raw13g, distinguishing CoreOS and SELF files, and obtaining the code region of a running kernel."
date: "2026-10-09"
translation_key: "ps4-pro-research-journey"
tags: ["PS4", "Hardware", "Firmware", "Reverse Engineering", "Research"]
category: "STUDY/FirmWare 분석(시도)"
private: false
published: true
---

For a while, I had been working on NAS vulnerability research with Synology and QNAP products. Then I started wondering what it would be like to analyze a PlayStation.

I initially thought that obtaining firmware and opening its filesystem would reveal the next step. Well… on the PS4, the bytes read from flash, the executable files in storage, and the code actually running on the device did not fit together quite so easily.

I began by opening the console and obtaining a dump. Later, reviewing raw13g and examining the GoldHEN environment led to obtaining the code region of the running kernel. This post follows what I confirmed along the way and where I got stuck again.

> **Related reading**
>
> I covered the JavaScript files and their main functions in [[PS4] raw13g Code Review](/en/posts/ps4-raw13g-review/). This post connects the hardware work that came before that review with the observations I made on the console afterward.

## 1. Starting with the console

As soon as the console arrived, I powered it on and checked its system version. The first version I observed was **13.50**. I later continued the investigation on **13.52** as well.

![The white PS4 Pro and controller prepared for this research](/assets/research/ps4-pro-research-journey/01-console.webp)

*The PS4 Pro prepared for the project. I could not afford to replace it, so I wanted to be careful.*

With NAS devices, I had sometimes started by obtaining firmware files or examining the system through management features and SSH. I could not immediately find that familiar starting point on the PS4. I decided to begin with what I could inspect directly on the hardware.

Fortunately, the official PlayStation channel had a [PS4 Pro teardown video](https://www.youtube.com/watch?v=euBlNq5kda0). I referred to the screw and connector locations while opening the console far enough to expose its motherboard.

![The PS4 Pro opened far enough to expose its motherboard](/assets/research/ps4-pro-research-journey/02-open-board.webp)

The marking on the board was **NVG-004**. Board revisions can differ even within the PS4 family, so I first compared the reference photographs with the hardware in front of me.

![The NVG-004 marking printed on the motherboard](/assets/research/ps4-pro-research-journey/03-board-revision.webp)

![Board revisions and service headers from the PS4 reference used during the investigation](/assets/research/ps4-pro-research-journey/04-board-reference.webp)

*The [board comparison from ps4-wee-tools](https://github.com/andy-man/ps4-wee-tools) used during the investigation. I compared my board with the NVG family shown on the right.*

The UART points also caught my attention. Finding them did not automatically provide boot logs or a shell, though. At this stage, I identified communication points on the board; I did not record that as having obtained a UART shell.

## 2. A familiar Winbond chip

![Close-up of the Winbond W25Q256JV flash memory on the board](/assets/research/ps4-pro-research-journey/05-flash-chip.webp)

The flash-memory marking identified a **Winbond W25Q256JV**. I first checked its package and pin functions in the [official datasheet](https://www.winbond.com/hq/support/documentation/?__locale=en&category=%2F.categories%2Fresources%2Fdatasheet%2F&family=%2Fproduct%2Fcode-storage-flash%2Fqspi-nor%2Findex.html&line=%2Fproduct%2Fcode-storage-flash%2Findex.html&pno=W25Q256JV).

The W25Q256JV is a 256Mbit SPI NOR flash device, equivalent to **32MiB** in bytes. That is the capacity of this chip, which needs to be distinguished from the console's entire storage capacity or the size of all its firmware.

![Package and pin-function table from the W25Q256JV datasheet](/assets/research/ps4-pro-research-journey/06-datasheet.webp)

I was wondering whether I would have to write another script, but flashrom already had a definition for this family!

![The Winbond flash-device definition inspected in flashrom](/assets/research/ps4-pro-research-journey/07-flashrom.webp)

*The [flashrom Winbond definition](https://github.com/flashrom/flashrom/blob/main/flashchips/winbond.c) I checked at the time. I examined capacity and supported operations as well as the chip name.*

I used the datasheet to establish the physical chip's specifications and compared that with how flashrom identified it. For the read operation, I used a **Raspberry Pi and PCBite**.

![PCBite probes positioned on the PS4 Pro board while reading flash data](/assets/research/ps4-pro-research-journey/08-dump-setup.webp)

I worked on the extraction with a senior colleague and, fortunately, we obtained a dump.

## 3. Obtaining a dump was different from understanding it

I thought things might become easier from here. But `binwalk` did not immediately reveal the filesystem or recognizable signatures I had expected.

My first reaction was to wonder whether an RTOS explained it. I also wondered whether the data was encrypted. However, **the absence of recognizable signatures alone cannot establish the operating-system type or prove encryption**. I first needed to know which region I had read and what format to expect there.

The initial results were as follows.

| Item | Observation |
|---|---|
| Device | PS4 Pro, NVG-004 |
| System versions | 13.50, with later work on 13.52 |
| Investigated chip | Winbond W25Q256JV, 32MiB SPI NOR |
| Acquired material | Raw data read from flash |
| Initial analysis | `binwalk` did not immediately identify the expected filesystem or signatures |

Having a file on disk did not mean I was ready to analyze accessible executables or a filesystem. **Reading the data left another task: identifying what the data actually represented.**

I had hoped this part would be straightforward. Apparently, this was where things started getting more complicated…

## 4. Reviewing raw13g and observing GoldHEN

Stored data alone did not give me enough insight into the console's behavior, so I also examined the running system. I analyzed the public `raw13g` code and **saw GoldHEN appear on my console**.

Once I saw the result on screen, I wanted to understand the code behind it. Where did the JavaScript files connect? What did the Worker do? How were the external binaries loaded?

I covered those questions separately in [[PS4] raw13g Code Review](/en/posts/ps4-raw13g-review/). Here, I will continue with the subsequent device observations.

At first, I wondered whether GoldHEN would give me a shell in the same way as a typical Linux device. Reading [GoldHEN's feature documentation](https://github.com/GoldHEN/GoldHEN/blob/master/README.md) and examining its behavior showed that the services had distinct roles.

| Service | Documented port | Role distinguished in this research |
|---|---:|---|
| FTP Server | 2121 | Listing and transferring accessible files |
| Klog Server | 3232 | Receiving log output |
| BinLoader | 9090 | Receiving and loading a separate program |

File transfer and log output are different capabilities from a command shell. A feature appearing in a menu, being enabled, and accepting an actual connection also need to be checked separately.

The records of some services changing from closed to accepting connections are covered in the [port-observation section of the earlier review](/en/posts/ps4-raw13g-review/#section-8-what-the-port-records-show). From that point, I kept the on-screen result separate from observations of each service.

## 5. Firmware-related files were not all the same thing

As I organized the material, the phrase “firmware dump” became too broad. An update package, flash data, a stored kernel file, and running kernel code were different kinds of evidence.

| Material | Meaning used in this post |
|---|---|
| Raw SPI NOR dump | Bytes read directly from the chip |
| PUP | An update package |
| CoreOS slot material | Slot-level material containing system components |
| SELF | Sony's container format for an executable image and metadata |
| Runtime kernel text | A code region obtained from the running kernel |

I initially expected these firmware-related files to open in similar ways. Distinguishing their origins and formats helped me work out which tools and questions were appropriate for each one.

I was able to separate internal SELF files from the CoreOS slot material acquired from the console. **The SELF files from slot A declared version 13.52; those from slot B declared 13.50.** Among them, the `80010002` object was identified as the AMD64 kernel SELF.

| Material | File size | State recorded in the analysis |
|---|---:|---|
| Slot A `kernel.self` | 10,866,322 bytes | Declares 13.52; internal segments retain encryption attributes |
| Slot B `kernel.self` | 10,865,570 bytes | Declares 13.50; internal segments retain encryption attributes |

The relationships between these artifacts are shown below. The SELF files separated from the slots and the ELF obtained from the running kernel are placed in separate groups.

![The relationship between kernel.self files in CoreOS slots A and B and kernel_text.elf acquired from the running 13.52 kernel](/assets/research/ps4-pro-research-journey/09-material-structure-en.svg)

*Arrows show containment or acquisition relationships. Stored CoreOS material and runtime code are grouped separately. The SELF retains encryption attributes on its internal segments; the runtime ELF contains the acquired R-X code region.*

There was another step left here, too. Reading the outer slot structure and identifying SELF headers did not make the internal executable code immediately readable. Separating a container and having analyzable code inside it were different results.

## 6. Obtaining the running kernel's code region

Separately from examining the stored SELF files, I **obtained the text region of the running kernel on the 13.52 console and preserved it as `kernel_text.elf`**. Unlike the initial flash dump, this gave me an ELF suitable for code analysis.

The acquired file has the following properties.

| Property | Confirmed value |
|---|---|
| File size | 13,625,176 bytes |
| ELF format | ELF64, little-endian |
| Target architecture | AMD64 / x86-64 |
| ELF OS ABI field | FreeBSD |
| Loadable segments | One `PT_LOAD` |
| Segment permission flags | Read and execute set; write not set (`R-X`) |

I also retained its SHA-256 for file identification.

`44e2afd250f6bf60bef56dd73e3290c89cda330f2a0ccd980127e4c33ddeb67f`

Here, `PT_LOAD` identifies a program-header entry describing a loadable region. `R-X` means the read and execute flags are set. This file contains one such segment. Checking those properties lets me describe the result more precisely than simply saying I obtained a kernel file.

This artifact is **a kernel code image for static analysis**. It is not a full kernel-memory dump preserving every aspect of the running device. It should not be treated as including the kernel's writable data regions or the state of every process.

The permission flags in the ELF header describe the file's layout. On their own, they neither verify the acquisition tool's entire behavior nor reconstruct every page permission at acquisition time.

Still, this was considerable progress from where I had stopped after the initial `binwalk` output. I now had code to examine in tools such as IDA, with function calls I could follow to turn broad questions into more specific ones.

## 7. Separating the layers of update processing

The PUP file format alone did not explain the entire update process either. Code requesting an update, code reading and verifying a package, and interfaces handling lower-level work had different roles.

In `safemode.elf`, I found error strings containing `sceUpdaterVerifySign`, `sceUpdaterReadUpkg`, and `sceUpdaterUpdateUpkg`. Following references to those strings helped distinguish calls related to verification, package reading, and update processing.

| Analysis clue | What it helped establish |
|---|---|
| Update-related error strings and their references | What operation the code was attempting at a failure point |
| References to `/dev/pup_update0` | A device interface for requesting lower-level update processing |
| Code around device-control requests (`ioctl`) | Requests separated into header, segment, and block processing |

The observed request structure is summarized below. The three branches below the device interface distinguish processing units; the calling code checks the returned result.

![Conceptual flow from PUP reading in safemode.elf through pup_update0 requests to header, segment, and block processing and returned results](/assets/research/ps4-pro-research-journey/10-update-flow-en.svg)

*This summarizes requests and result handling identified through static analysis. Header, segment, and block denote processing units rather than separate physical devices or a fixed sequence of three operations.*

Finding a string did not establish everything about a function's role. I also needed to examine its callers, arguments, and return-value handling.

An important distinction here was **a call relationship identified through static analysis versus a path observed executing on the device**. The presence of an update call in code is different from a claim that I performed an update through that path during this experiment. This part of the work records analysis of files and call structure.

## 8. Revisiting what the observations showed

I also distinguished LaunchPad from BinLoader. The location where LaunchPad looked for stored programs and the location where BinLoader temporarily handled received files had different roles and lifetimes. Seeing a file in a list did not establish that it could be loaded successfully.

The format-related notes needed another look as well. Some observations indicated an ELF requirement, while earlier acquisition records described a different transfer format. Instead of concluding that BinLoader always accepts only ELF, it was more accurate to record **the version, loader implementation, and actual file format** together.

A similar issue appeared when comparing small memory fragments. If two 256-byte reads start just `0x10`, or 16 bytes, apart, **240 bytes overlap**. Repeated content may then result from reading the same memory twice rather than from a distinct structure in the data.

Concatenating four fragments into a 1,024-byte file does not establish that 1,024 contiguous bytes were captured if those fragments overlapped or came from separate regions. Along with the file size, I needed to preserve each fragment's starting position and extent.

## 9. Bringing the code and the console together

At first, I thought analysis would begin once I had read the flash. In practice, I also needed to identify the bytes, distinguish containers from executable code, and connect stored files with runtime material.

The work progressed through **obtaining a flash dump, identifying SELF files inside CoreOS, and acquiring runtime kernel code from 13.52**. Reviewing raw13g helped me understand the software entry flow. The subsequent investigation focused on establishing what the acquired material actually showed.

Next, I want to examine the kernel text alongside system modules and follow the update-processing calls further. I am also interested in what changes between versions and how behavior read from code connects with actual logs.

There is still plenty to examine. But compared with the original thought that I wanted to analyze a PlayStation, I now have a much clearer idea of what material I have and what to look at next.

I spent quite a while absorbed in NAS devices. It looks like the PlayStation will keep me occupied for a while as well.

**Continue reading:** [[PS4] raw13g Code Review](/en/posts/ps4-raw13g-review/)

## References

1. [Official PlayStation PS4 Pro teardown video](https://www.youtube.com/watch?v=euBlNq5kda0)
2. [Winbond W25Q256JV documentation](https://www.winbond.com/hq/support/documentation/?__locale=en&category=%2F.categories%2Fresources%2Fdatasheet%2F&family=%2Fproduct%2Fcode-storage-flash%2Fqspi-nor%2Findex.html&line=%2Fproduct%2Fcode-storage-flash%2Findex.html&pno=W25Q256JV)
3. [flashrom Winbond chip definitions](https://github.com/flashrom/flashrom/blob/main/flashchips/winbond.c)
4. [ps4-wee-tools board reference](https://github.com/andy-man/ps4-wee-tools)
5. [GoldHEN feature documentation](https://github.com/GoldHEN/GoldHEN/blob/master/README.md)
6. [[PS4] raw13g Code Review](/en/posts/ps4-raw13g-review/)

File sizes and structural observations are based on the private research records `LIVE_COREOS_ACQUISITION.md`, `RUNTIME_TEXT_ACQUISITION.md`, the update-call analysis notes, and the retained artifacts.
