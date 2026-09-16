---
title: "[PWNABLE] FPO"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ Frame Pointer Overflow (brief explanation) Modulating sfp. As a result, it is a technique for modulating IP registers. Overflow of at least 1 byte in the sfp area must be possible. A function other than main() is required. this"
date: "2024-06-24"
translation_key: "tistory-f391d7d86e68"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FPO"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

#### Frame Pointer Overflow (briefly explained)

Modulating sfp is a technique that modifies the IP register.

- Overflow of at least 1 byte must be possible in the sfp area.
- A function other than main() is required.

This technique is possible because of the Epilogue. leave - ret restores the sfp of the previous function and performs return.

If we look closely at each configuration, it is as follows.

```
leave
	- mov esp, ebp
	- pop ebp

ret
	- pop eip
	- jmp eip
```

Let's take a look at a simple picture.

![](/assets/images/tistory/tistory-f391d7d86e68/001.png)

Generally, when a function is called, it has the structure above.

Now let’s implement FPO here.

![](/assets/images/tistory/tistory-f391d7d86e68/002.png)

First, this is the part where the mov esp and ebp codes are executed. Before execution, 1 byte of sfp was modified.

EBP and ESP point to the same location.

![](/assets/images/tistory/tistory-f391d7d86e68/003.png)

Afterwards, perform pop ebp.

This is where a problem arises. The sfp stored in the stack is moved to ebp as is. At this time, if it is set to a space in the stack as shown in the picture, the sfp in question will be used after ret.

![](/assets/images/tistory/tistory-f391d7d86e68/004.png)

Then perform the ret process.

If you look at it up to this point, you may not see any major problems with the execution itself.

![](/assets/images/tistory/tistory-f391d7d86e68/005.png)

When the func function is executed again and the epilogue process is completed, the problem created earlier arises.

The leave-ret process is the same, so explanation will be omitted.

If you enter shellcode in buf before the first epilog step and modify sfp with the previous address value, the shellcode is executed in the second epilog step.