---
title: "[PWNABLE] Canary_설명"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ SSP(Stack Smashing Protector) Stack buffer Overflow로부터 sfp와 ret를 보호하기 위한 기법으로, Stack의 canary라는 값을 이용하여 검증을 수행한다. Stack 그림으로 보면 buf와 sfp 사이에"
date: "2023-09-24"
translation_key: "tistory-7e1b9689acc3"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Canary%EC%84%A4%EB%AA%85"
private: false
---

#### **※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

#### SSP(Stack Smashing Protector)

Stack buffer Overflow로부터 sfp와 ret를 보호하기 위한 기법으로,

Stack의 canary라는 값을 이용하여 검증을 수행한다.

![](/assets/images/tistory/tistory-7e1b9689acc3/001.png)

Stack 그림으로 보면 buf와 sfp 사이에 위치한다.

공격자가 ret부분을 덮어씌기 위해 값을 일반적인 overflow 공격을 수행하면

canary값이 변조가 될 것이고, 이를 에필로그에서 감지하여 프로그램을 종료시킨다.

![](/assets/images/tistory/tistory-7e1b9689acc3/002.png)

checksec이라는 명령어를 이용하여 바이너리 파일에 적용된 메모리 보호기법에 대해 확인할 수 있다.

![](/assets/images/tistory/tistory-7e1b9689acc3/003.png)

위의 그림의 경우, canary가 적용되어 있는 상태이다.

만약 컴파일을 dynamic 방식이 아닌 static 방식으로 진행을 했다면

위의 checksec로는 canary 적용 여부를 판별하기가 어렵다.

이유는 checksec의 구현 코드를 가지고 설명해보겠다.

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

이 코드의 내용을 간략하게 살펴보면,

바이너리 파일안에 '\_\_stack\_chk\_fail' 혹은 '\_\_intel\_security\_cookie'라는 symbol이 존재하는지를 확인한다.

이후 존재하면 canary가 적용되 있는 것으로 판별하게 되는데,

static 방식으로 컴파일한 파일의 경우에는 모든 함수들을 바이너리 안에 저장을 해두기 때문에

위 symbol이 사용되지 않더라도 파일안에 존재하게 된다.

즉, 파일안에 symbol이 존재하는 것만으로도 canary가 적용되어 있다고 판단해버린다.

dynamic 방식 - canary가 적용되어 있는 파일

![](/assets/images/tistory/tistory-7e1b9689acc3/004.png)

static 방식 - canary가 적용되어 있지 않은 파일

![](/assets/images/tistory/tistory-7e1b9689acc3/005.png)

* * *

이제 파일안에서 어떻게 작동하는지를 살펴보겠다.

먼저 함수의 프롤로그를 살펴보면

![](/assets/images/tistory/tistory-7e1b9689acc3/006.png)

fs:0x28 로부터 값을 가져와서 \[rbp-0x8\]에 저장하는 것을 알 수 있다.

여기서 fs는 세그먼트 레지스터로, 유저모드와 커널모드에 따라 가르키는 값에 차이가 있다.

우리가 접근 가능한 영역은 유저모드 영역으로 현재 thread의 TEB를 가르킨다.

fd:0x28에 어떤 값이 있는지 확인해 보겠다.

![](/assets/images/tistory/tistory-7e1b9689acc3/007.png)

fs:0x28에 \\x00으로 끝나는 값이 들어가 있다.

이제 stack에 들어가 있는 canary를 확인해보겠다.

![](/assets/images/tistory/tistory-7e1b9689acc3/008.png)

stack을 살펴보면 canary값인 0xf78ad2d1986dc400이 있는데 위에서 확인한 값이랑 같은 것을 알 수 있다.

fs:0x28에는 canary가 들어가 있는 것을 확인할 수 있다.

이번에는 에필로그를 살펴보겠다.

leave-ret를 하기전에 \_\_stack\_chk\_fail이라는 함수를 호출한다.

이때 해당 함수의 호출 조건으로 \[rbp-0x8\]과 fs:0x28의 값을 xor연산을 하게 된다.

![](/assets/images/tistory/tistory-7e1b9689acc3/009.png)

stack의 canary와 master canary를 비교하여 참이면 정상종료, 거짓이면 해당 함수를 호출한다.

만약 해당 함수가 호출이 된다면 처음에 봤던 이미지처럼 비정상 종료가 된다.

![](/assets/images/tistory/tistory-7e1b9689acc3/010.png)

* * *

이제 canary가 생성되는 과정을 살펴보겠다.

init\_tls()를 살펴보면 dlallocate\_tls\_storage()호출하는 부분을 찾을 수 있다.

![](/assets/images/tistory/tistory-7e1b9689acc3/011.png)

dlallocate\_tls\_storage()를 살펴보면 malloc으로 tls영역을 할당하는 것을 볼 수 있다.

![](/assets/images/tistory/tistory-7e1b9689acc3/012.png)

더보기

전체 코드

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

dl\_allocate\_tls\_storage()에서 할당한 tls영역을 fs로 초기화 하는 TLS\_INTI\_TP 매크로이다.

arch\_prctl()에 의해서 설정이 진행된다.

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

이제 canary의 생성과정을 보도록 하겠다.

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

securti\_init()이라는 함수에서 tls영역에 랜덤한 값을 저장한다.

```
  uintptr_t pointer_chk_guard
	    = _dl_setup_pointer_guard (_dl_random, stack_chk_guard);
```

\_dl\_random을 인자로 값을 생성하는데 이 때 생성된 값이 canary이다.

\_dl\_random을 살펴보면 아래와 같이 정의되어 있다.

```
 case AT_RANDOM:
	_dl_random = (void *)av->a_un.a_val;
	break;
```

AT\_RANDOM은 ELF 바이너리의 vector 중 하나이다.

프로세스가 시잘될 때 동적 로더가 제공하는 정보로 AT\_RANDOM의 기능은 난수 생성을 위한 데이터를 제공한다.

즉, \_dl\_random은 프로그램이 실행될 때마다 무작위 값으로 초기화하는 특성을 가진다.

```
/* Set the stack guard field in TCB head.  */
#define THREAD_SET_STACK_GUARD(value) \
  THREAD_SETMEM (THREAD_SELF, header.stack_guard, value)
```

canary값을 header.stack.guard에 넣어주는 매크로이다.

\=> TLS+0x28에 canary를 넣어준다고 보면 된다.
