from time import sleep
def p():
  print("hello")
def func(func1 , n):
  sleep(0.001 * n )
  func1()
func(p , 3)
