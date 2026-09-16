---
title: "[FIRMWARE] Command"
description: "I would like to take note of frequently used commands when attempting firmware analysis. Since the style of each analyst is different, you can assume that this person mainly uses these commands just for reference. This is a tool that anyone who has seen binwalk firmware at least once has used it. It analyzes the detailed elements that make up the firmware in signature units."
date: "2025-08-25"
translation_key: "tistory-058612323cbb"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/FIRMWARE-Command"
private: false
---

I would like to take note of frequently used commands when attempting firmware analysis.

Since the style of each analyst is different, you can assume that this person mainly uses these commands just for reference.

### binwalk

It is a tool that anyone who has ever seen firmware has used.

The detailed elements that make up the firmware are analyzed and displayed in signature units.

![](/assets/images/tistory/tistory-058612323cbb/001.png)

Options used together include -eM.

```
binwalk -eM {firmware}
```

\-e : Automatically extract to known file formats

\-M: Recursively search extracted files

If you use these two options together, the firmware will be extracted first, the files inside will be downloaded again, the test will be performed again, and then extracted.

In other words, it is used together because it digs into and extracts files until there are no more files to extract.

### dd

This is an abbreviation for data description and is literally a command used when copying data from firmware or disk.

Although it is a low-level data copy and conversion command, it is often used because the necessary commands can be extracted from the firmware.

```
dd if={firmware_name} of={output_file} bs=1 skip={start_offset} count={data_size}
```

![](/assets/images/tistory/tistory-058612323cbb/002.png)

If you look at the picture above, the size data is grouped with $(( ~~~ )).

Originally, as in skip, a decimal number value must be entered, so the data size must be calculated and entered manually, but it is cumbersome to do it one by one, so automatic calculation is performed by using it like this.

###xxd

This command allows you to view the HEX value of a file.

Usually head | more | Used with the tail command.

![](/assets/images/tistory/tistory-058612323cbb/003.png)

In a typical WSL environment, I would try using 010 Editor or HxD, but as a user of a personal server, I use it a lot because the process of downloading, modifying, and uploading it each time is cumbersome.

For more detailed analysis, I save it and view it using the > output.txt command.

```
xxd {firmware} 
xxd {firmware} | head
xxd {firmware} | more
xxd {firmware} | tail
xxd {firmware} > output.txt
xxd {firmware} | grep "~~"
```

### file

This command tells you what type of file it is.

It is mainly used to check files extracted through the binwalk or dd command.

![](/assets/images/tistory/tistory-058612323cbb/004.png)

### grep

It is mainly used when searching for specific strings/keywords in a file.

Use the \-rn option for full search.

```
grep -rn "~~"
```

![](/assets/images/tistory/tistory-058612323cbb/005.png)

\-r : Perform a recursive search to the specified directories and.

\-n: Shows which line of the file the string found by searching is on.

### find

It is mainly used when searching for specific files.

```
find ./ -name "*cgi*"
```

### mount / umount

This method is mainly used when analyzing a firmware file by mounting it.

The images used are in previous posts, so pass.

```
sudo mount -t {cramfs,squafs ...} -o loop,ro {firmware} {mnt}

sudo umount {mnt}
```