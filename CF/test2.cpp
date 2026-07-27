#include<iostream>
#include<climits>

int main(){
    int t;
    std::cin >> t;
    while( t-- ){
        long long int n;
        std::cin >> n;
        long long int ans[3*n], k = 3*n , j = 1;

        for (int i = 3*n - 1 ; i >= 0 ; i-=3 ){
            ans[i] = k;
            ans[i-1] = k - 1;
            ans[i-2] = j;
            k -= 2;
            j++;
        }
        for( int i = 0; i < 3*n; i++){
            std::cout << ans[i] <<" "; 
        }
        std::cout << "\n"; 
    }
    return 0;
}