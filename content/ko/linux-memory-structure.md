---
title: "[LINUX] 메모리 구조"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 리눅스의 메모리 구조는 [CODE 세그먼트], [DATA 세그먼트], [BSS 세그먼트], [HEAP 세그먼트], [STACK 세그먼트]로 구성되어 있다. CODE 세그먼트 유저가 작성한 코드가 저장되는 영역으로 실행할 프로그램의 코드가 저장되어 있"
date: "2023-09-04"
translation_key: "tistory-e863c2da7c8a"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/LINUX-%EB%A9%94%EB%AA%A8%EB%A6%AC-%EA%B5%AC%EC%A1%B0"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

![](/assets/images/tistory/tistory-e863c2da7c8a/001.png)

리눅스의 메모리 구조는 \[CODE 세그먼트\], \[DATA 세그먼트\], \[BSS 세그먼트\], \[HEAP 세그먼트\], \[STACK 세그먼트\]로 구성되어 있다.

### **CODE 세그먼트**

유저가 작성한 코드가 저장되는 영역으로 실행할 프로그램의 코드가 저장되어 있다. 

CPU에서 이 코드를 읽고 실행을 시켜야 하기 때문에 읽기 권한과 실행 권한을 가지고 있다.

```
void func1(){ ... }
void func2(){ ... }
int main(){ ... }
```

### **DATA 세그먼트**

초기화된 전역 변수 혹은 정 변수가 저장되는 영역으로 프로그램 시작과 함께 할당되며 종료시 같이 소멸된다.

읽고 쓰기까지 가능한 data와 읽기만 가능한 rodata(Read Only Data)로 구성된다.

```
int num1 = 1; //data
const int num2 = 2; //rodata

void func1(){
	static int num3 = 3; //data
}
```

### **BSS 세그먼트**

DATA 세그먼트와난 다르게 초기화 되지 않은 전역 변수 혹은 정적 변수가 저장되는 영역이다. 

```
int num; //bss
const int num2; //rodata

void func1(){
	static int num3 = 3; //bss
}
```

### **STACK 세그먼트**

프로그램이 실행되는 동안 생성되는 지역변수, 매개변수 등을 포함한 데이터들이 저장되는 영역이다.

때문에 읽기와 쓰기 권한을 가지게 된다.

STACK의 특징으로는 크기가 확장될 때 높은 주소에서 낮은 주소로 자란다는 것이다. 

```
void func1(){
	int num1;  //stack
	int num2 = 2; //stack
}
```

더보기

#### **스택 프레임(STACK Frame)**

STACK 세그먼트가 사용하는 단위이다. 스텍 프레임은 함수가 호출될 때 생성되고 반환할 때 해제된다.

![](/assets/images/tistory/tistory-e863c2da7c8a/002.png)

위 그림에서 보면 스택 프레임의 크기를 0x20만큼 생성하는 것을 볼 수 있다.  
(위 예제는 main()에서 func()를 호출하는 코드이다.)

그렇다면 스택프레임의 전체 크기가 0x20이다라고 생각할 수 있겠지만 실제로는 sfp와 ret의 값을 포함시켜야 한다.

즉, 64비트 기준으로 buf(0x20 byte) + sfp(0x8 byte) + ret(0x8 byte)해서 총 0x30만큼의 크기를 가지고 있게 된다.

![](/assets/images/tistory/tistory-e863c2da7c8a/003.png)

sfp에는 이전 함수의 rbp의 값이 들어있고, ret에는 반환할 때 복귀할 주소를 가리키고 있어야 한다.

이 값들이 들어있는지 확인해보도록 하겠다.

main()에서 func()를 호출하는 부분이다.

![](/assets/images/tistory/tistory-e863c2da7c8a/004.png)

위 그림만 가지고 생각해보면 ret 즉 복귀할 함수의 주소는 call func; 다음 주소인 0x000055555555522c이 들어가 있을 것이다. 이어서 sfp도 확인해보겠다.

![](/assets/images/tistory/tistory-e863c2da7c8a/005.png)

 func()에서의 sfp는 main()의 rbp이기 때문에 main()의 rbp를 확인해주면 된다. main()의 rbp는 gdb로 보았을 때 0x7fffffffe290인 것을 알 수 있다.

여기까지 보았을 때 buf 변수의 크기인 0x20뒤에 sfp값인 0x7fffffffe290, ret의 값인 0x000055555555522c이 들어있으면 된다.

func()에서 rsp를 확인한 모습이다.

![](/assets/images/tistory/tistory-e863c2da7c8a/006.png)

0x7fffffffe260~0x7fffffffe280이 buf 변수의 영역, 0x7fffffffe280이 sfp, 0x7fffffffe288이 ret인 것을 확인할 수 있다.

### **HEAP 세그먼트**

프로그램 실행 중 동적으로 메모리를 할당하기 위한 공간이다. 

이 부분에 대해서는 나중에 ptmalloc에 대한 내용을 작성할 때 본격적으로 다룰 예정이다.

```
int *num = malloc(1)  //heap

void func1(){
	int *ptr = malloc(8). //heap
}
```
