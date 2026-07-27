#include<iostream>

int sum_of_digits(long long int n){
    int sum = 0;
    while( n > 0 ){
        int val = n % 10;
        sum += val;
        n = n / 10;
    }
    return sum;
}
int main(){
    int t;
    std::cin >> t;
    while( t-- ){
        long long int n, ans = 0;
        std::cin >> n;
        for ( long long int i = n + 1 ; i <= n + 90; i++ ){
            int val = sum_of_digits(i);
            if( i - val == n ){
                ans++;
            }
        }
        std::cout << ans << "\n";
    }
    return 0;
}