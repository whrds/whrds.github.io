---
title: "[PWNABLE] Canary_Description"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ SSP (Stack Smashing Protector) is a technique to protect sfp and ret from stack buffer overflow. Verification is performed using the value called canary of the stack. If you look at the stack picture, it is between buf and sfp."
date: "2023-09-24"
translation_key: "tistory-7e1b9689acc3"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Canary%EC%84%A4%EB%AA%85"
private: false
---

#### **※ If there are any mistakes, please let me know. We will make corrections after confirmation.** **※** 

#### Stack Smashing Protector (SSP)

A technique to protect sfp and ret from stack buffer overflow.

Verification is performed using the value called canary of the stack.

![](/assets/images/tistory/tistory-7e1b9689acc3/001.png)

If you look at the stack picture, it is located between buf and sfp.

If an attacker performs a general overflow attack on the value to overwrite the ret part,

The canary value will be tampered with, and this will be detected in the epilog and the program will be terminated.

![](/assets/images/tistory/tistory-7e1b9689acc3/002.png)

You can check the memory protection technique applied to the binary file using the checksec command.

![](/assets/images/tistory/tistory-7e1b9689acc3/003.png)

In the case of the picture above, canary is applied.

If compilation is done in static method rather than dynamic method,

It is difficult to determine whether canary is applied using the above checksec.

I will explain the reason using the checksec implementation code.

```
# check for stack canary support
  ${debug} && echo -e "\n***function proccheck->canary"
  if ${readelf} -s "${1}/exe" 2>/dev/null | grep -q 'Symbol table'; then
    if ${readelf} -s "${1}/exe" 2>/dev/null | grep -Eq '__stack_chk_fail|__intel_security_cookie'; then
      echo_message '\033[32mCanary found         \033[m   ' 'Canary found,' ' canary="yes"' '"canary":"yes",'
    else
      echo_message '\033[31mNo canary found      \033[m   ' 'No Canary found,' ' canary="no"' '"canary":"no",'
    fi
  else
    if [[ "${1}" == "1" ]] ; then
      echo_message '\033[33mPermission denied    \033[m   ' 'Permission denied,' ' canary="Permission denied"' '"canary":"Permission denied",'
    else
      echo_message '\033[33mNo symbol table found \033[m  ' 'No symbol table found,' ' canary="No symbol table found"' '"canary":"No symbol table found",'
    fi
  fi
```

Briefly looking at the contents of this code:

Check whether the symbol ‘\_\_stack\_chk\_fail’ or ‘\_\_intel\_security\_cookie’ exists in the binary file.

Afterwards, if it exists, it is determined that the canary is applied.

In the case of files compiled using the static method, all functions are stored in the binary.

Even if the above symbol is not used, it exists in the file.

In other words, the mere presence of a symbol in the file determines that the canary is applied.

dynamic method - file with canary applied

![](/assets/images/tistory/tistory-7e1b9689acc3/004.png)

static method – files to which canary is not applied

![](/assets/images/tistory/tistory-7e1b9689acc3/005.png)

* * *

Now let's take a look at how it works inside a file.

First, look at the prologue of the function:

![](/assets/images/tistory/tistory-7e1b9689acc3/006.png)

You can see that the value is taken from fs:0x28 and stored in \[rbp-0x8\].

Here, fs is a segment register, and the value it points to varies depending on user mode and kernel mode.

The area we can access is the user mode area, which points to the TEB of the current thread.

Let’s check what value is in fd:0x28.

![](/assets/images/tistory/tistory-7e1b9689acc3/007.png)

fs:0x28 contains a value ending with \\x00.

Now let’s check the canary in the stack.

![](/assets/images/tistory/tistory-7e1b9689acc3/008.png)

If you look at the stack, you can see that there is a canary value of 0xf78ad2d1986dc400, which is the same as the value checked above.

You can see that a canary is included in fs:0x28.

This time we will look at the epilogue.

Before leaving-ret, call the function \_\_stack\_chk\_fail.

At this time, an xor operation is performed on the values ​​of \[rbp-0x8\] and fs:0x28 as a calling condition for the function.

![](/assets/images/tistory/tistory-7e1b9689acc3/009.png)

Compares the stack canary and the master canary. If true, it terminates normally. If false, the corresponding function is called.

If the function is called, it terminates abnormally as shown in the image you saw at first.

![](/assets/images/tistory/tistory-7e1b9689acc3/010.png)

* * *

Now let's look at the process of creating a canary.

If you look at init\_tls(), you can find a part that calls dlallocate\_tls\_storage().

![](/assets/images/tistory/tistory-7e1b9689acc3/011.png)

If you look at dlallocate\_tls\_storage(), you can see that the tls area is allocated using malloc.

![](/assets/images/tistory/tistory-7e1b9689acc3/012.png)

See more

full code

```
void *
_dl_allocate_tls_storage (void)
{
  void *result;
  size_t size = GLRO (dl_tls_static_size);

#if TLS_DTV_AT_TP
  /* Memory layout is:
    [ TLS_PRE_TCB_SIZE ] [ TLS_TCB_SIZE ] [ TLS blocks ]
  ^ This should be returned.  */
  size += TLS_PRE_TCB_SIZE;
#endif

  /* Perform the allocation.  Reserve space for the required alignment
     and the pointer to the original allocation.  */
  size_t alignment = GLRO (dl_tls_static_align);
  void *allocated = malloc (size + alignment + sizeof (void *));
  if (__glibc_unlikely (allocated == NULL))
    return NULL;

  /* Perform alignment and allocate the DTV.  */
#if TLS_TCB_AT_TP
  /* The TCB follows the TLS blocks, which determine the alignment.
     (TCB alignment requirements have been taken into account when
     calculating GLRO (dl_tls_static_align).)  */
  void *aligned = (void *) roundup ((uintptr_t) allocated, alignment);
  result = aligned + size - TLS_TCB_SIZE;

  /* Clear the TCB data structure.  We can't ask the caller (i.e.
     libpthread) to do it, because we will initialize the DTV et al.  */
  memset (result, '\0', TLS_TCB_SIZE);
#elif TLS_DTV_AT_TP
  /* Pre-TCB and TCB come before the TLS blocks.  The layout computed
     in _dl_determine_tlsoffset assumes that the TCB is aligned to the
     TLS block alignment, and not just the TLS blocks after it.  This
     can leave an unused alignment gap between the TCB and the TLS
     blocks.  */
  result = (void *) roundup
    (sizeof (void *) + TLS_PRE_TCB_SIZE + (uintptr_t) allocated,
     alignment);

  /* Clear the TCB data structure and TLS_PRE_TCB_SIZE bytes before
     it.  We can't ask the caller (i.e. libpthread) to do it, because
     we will initialize the DTV et al.  */
  memset (result - TLS_PRE_TCB_SIZE, '\0', TLS_PRE_TCB_SIZE + TLS_TCB_SIZE);
#endif

  /* Record the value of the original pointer for later
     deallocation.  */
  *tcb_to_pointer_to_free_location (result) = allocated;

  result = allocate_dtv (result);
  if (result == NULL)
    free (allocated);
  return result;
}
```

This is a TLS\_INTI\_TP macro that initializes the tls area allocated in dl\_allocate\_tls\_storage() to fs.

Setting is carried out by arch\_prctl().

```
# define TLS_INIT_TP(thrdescr) \
  ({ void *_thrdescr = (thrdescr);                                              \
     tcbhead_t *_head = _thrdescr;                                              \
     int _result;                                                              \
                                                                              \
     _head->tcb = _thrdescr;                                                      \
     /* For now the thread descriptor is at the same address.  */              \
     _head->self = _thrdescr;                                                      \
                                                                              \
     /* It is a simple syscall to set the %fs value for the thread.  */              \
     asm volatile ("syscall"                                                      \
                   : "=a" (_result)                                              \
                   : "0" ((unsigned long int) __NR_arch_prctl),                      \
                     "D" ((unsigned long int) ARCH_SET_FS),                      \
                     "S" (_thrdescr)                                              \
                   : "memory", "cc", "r11", "cx");                              \
                                                                              \
    _result ? "cannot set %fs base address for thread-local storage" : 0;     \
  })
```

Now let’s look at the canary creation process.

```
security_init (void)
{
	  /* Set up the stack checker's canary.  */
	  uintptr_t stack_chk_guard = _dl_setup_stack_chk_guard (_dl_random);
 	#ifdef THREAD_SET_STACK_GUARD
  THREAD_SET_STACK_GUARD (stack_chk_guard);
	#else
	  __stack_chk_guard = stack_chk_guard;
	#endif
	
	  /* Set up the pointer guard as well, if necessary.  */
	  uintptr_t pointer_chk_guard
	    = _dl_setup_pointer_guard (_dl_random, stack_chk_guard);
	#ifdef THREAD_SET_POINTER_GUARD
	  THREAD_SET_POINTER_GUARD (pointer_chk_guard);
	#endif
	  __pointer_chk_guard_local = pointer_chk_guard;
	
	  /* We do not need the _dl_random value anymore.  The less
	     information we leave behind, the better, so clear the
	     variable.  */
	  _dl_random = NULL;
	}
```

A function called securti\_init() stores random values in the tls area.

```
  uintptr_t pointer_chk_guard
	    = _dl_setup_pointer_guard (_dl_random, stack_chk_guard);
```

A value is created using \_dl\_random as an argument, and the value created at this time is canary.

Looking at \_dl\_random, it is defined as follows.

```
 case AT_RANDOM:
	_dl_random = (void *)av->a_un.a_val;
	break;
```

AT\_RANDOM is one of the vectors in the ELF binary.

The AT\_RANDOM function provides data for random number generation with information provided by the dynamic loader when the process is started.

In other words, \_dl\_random has the property of being initialized to a random value every time the program is executed.

```
/* Set the stack guard field in TCB head.  */
#define THREAD_SET_STACK_GUARD(value) \
  THREAD_SETMEM (THREAD_SELF, header.stack_guard, value)
```

This is a macro that puts the canary value into header.stack.guard.

\=> You can think of it as adding a canary to TLS+0x28.