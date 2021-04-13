class Solution {
public:
    bool divisorGame(int n) {
        bool flag = true;
        int counter = 0;
        if( n == 1 ) return false;
        while(flag){
            if ( n % 2 == 0){
                n = n-1;
            }else{
                int prime = 1;
                for(int j = 2 ; j * j < n ; j++){
                    if( n % j == 0 && j%2 == 1){
                        prime = j;
                        break;
                    }
                }
                n = n-prime;  
            }
            counter++;
            if( n == 1 ){
                flag = false;
            }
        }
        if( counter % 2 == 0 ){
            return false;
        }
        return true;
    }
};
